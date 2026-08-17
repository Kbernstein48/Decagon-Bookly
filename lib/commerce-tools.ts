import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  CheckoutError,
  completeSimulatedCheckout,
  getCheckoutReview,
} from "./checkout";
import type { BooklyDatabase } from "./database";
import books from "../knowledge/books.json";

type Customer = { id: number; email: string; firstName: string; lastName: string };
type Context = { sessionId?: string; authenticatedCustomer?: Customer };

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const now = () => new Date().toISOString();

const catalogSearchSchema = z.object({
  query: z.string().trim().max(300).optional(),
  book_type: z.string().trim().max(100).optional(),
  author: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(100).optional(),
  format: z.string().trim().max(100).optional(),
  availability: z.enum(["in_stock", "out_of_stock", "any"]).default("any"),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
const bookSchema = z.object({ book_id: z.string().trim().min(1) });
const addCartSchema = z.object({
  book_id: z.string().trim().min(1),
  format: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});
const updateCartSchema = z.object({ cart_item_id: z.string().trim().min(1), quantity: z.coerce.number().int().min(1).max(20) });
const removeCartSchema = z.object({ cart_item_id: z.string().trim().min(1) });
const clearCartSchema = z.object({ customer_confirmed: z.boolean() });
const checkoutSchema = z.object({ customer_confirmed: z.boolean() });
const checkoutActionSchema = z.object({
  checkout_id: z.string().trim().regex(/^checkout_[a-z0-9]{16}$/).optional(),
});
const submitOrderSchema = checkoutActionSchema.extend({
  confirmation_token: z.uuid(),
  customer_confirmed: z.boolean(),
});
const wishlistSchema = z.object({ book_id: z.string().trim().min(1) });
const alertSchema = z.object({ book_id: z.string().trim().min(1), format: z.string().trim().min(1) });

function validationError(error: z.ZodError) {
  return { ok: false, error: { code: "INVALID_TOOL_INPUT", message: "The tool input was incomplete or invalid.", details: error.issues } };
}

function authenticationRequired() {
  return { ok: false, error: { code: "AUTHENTICATION_REQUIRED", message: "The customer must sign in before using this account feature." } };
}

function sessionRequired() {
  return { ok: false, error: { code: "BROWSER_SESSION_REQUIRED", message: "A browser session is required to manage the cart." } };
}

function findBook(bookId: string) {
  const normalized = bookId.toLocaleLowerCase("en-US");
  return books.find((book) => book.slug.toLocaleLowerCase("en-US") === normalized);
}

function variants(db: BooklyDatabase, bookId: string) {
  return db.prepare(`
    SELECT sku, format, price_cents, inventory_quantity
    FROM catalog_items WHERE book_id = ? AND active = 1 ORDER BY price_cents
  `).all(bookId) as Array<{ sku: string; format: string; price_cents: number; inventory_quantity: number }>;
}

function catalogBook(db: BooklyDatabase, book: (typeof books)[number]) {
  const itemVariants = variants(db, book.slug);
  return {
    book_id: book.slug,
    title: book.title,
    author: book.author,
    book_type: book.book_type,
    genre: book.genre,
    description: book.description,
    audience: book.audience,
    themes: book.themes,
    variants: itemVariants.map((item) => ({
      sku: item.sku,
      format: item.format,
      price: money(item.price_cents),
      price_cents: item.price_cents,
      availability: item.inventory_quantity > 0 ? "in_stock" : "out_of_stock",
      inventory_quantity: item.inventory_quantity,
    })),
  };
}

function getOrCreateCart(db: BooklyDatabase, sessionId: string, customer?: Customer) {
  let cart = db.prepare("SELECT id FROM carts WHERE session_id = ? AND status = 'active'").get(sessionId) as { id: string } | undefined;
  if (!cart) {
    cart = { id: `cart_${randomUUID().replaceAll("-", "").slice(0, 16)}` };
    const timestamp = now();
    db.prepare(`INSERT INTO carts (id, session_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`)
      .run(cart.id, sessionId, customer?.id ?? null, timestamp, timestamp);
  } else if (customer) {
    db.prepare("UPDATE carts SET customer_id = ?, updated_at = ? WHERE id = ?").run(customer.id, now(), cart.id);
  }
  return cart.id;
}

export function cartSnapshot(db: BooklyDatabase, sessionId: string, customer?: Customer) {
  const cartId = getOrCreateCart(db, sessionId, customer);
  const items = db.prepare(`
    SELECT ci.id, ci.sku, ci.quantity, p.book_id, p.title, p.author, p.format,
           p.price_cents, p.inventory_quantity
    FROM cart_items ci JOIN catalog_items p ON p.sku = ci.sku
    WHERE ci.cart_id = ? ORDER BY ci.added_at
  `).all(cartId) as Array<{
    id: string; sku: string; quantity: number; book_id: string; title: string; author: string;
    format: string; price_cents: number; inventory_quantity: number;
  }>;
  const subtotalCents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const shippingCents = items.length === 0 || subtotalCents >= 3500 ? 0 : 499;
  return {
    ok: true,
    cart: {
      cart_id: cartId,
      items: items.map((item) => ({
        cart_item_id: item.id,
        sku: item.sku,
        book_id: item.book_id,
        title: item.title,
        author: item.author,
        format: item.format,
        quantity: item.quantity,
        unit_price: money(item.price_cents),
        line_total: money(item.price_cents * item.quantity),
        availability: item.inventory_quantity >= item.quantity ? "in_stock" : "insufficient_stock",
      })),
      item_count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: money(subtotalCents),
      shipping: shippingCents === 0 ? "Free" : money(shippingCents),
      total: money(subtotalCents + shippingCents),
      free_shipping_remaining: money(Math.max(0, 3500 - subtotalCents)),
    },
  };
}

function searchCatalog(db: BooklyDatabase, rawInput: unknown) {
  const parsed = catalogSearchSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const query = parsed.data.query?.toLocaleLowerCase("en-US") ?? "";
  const results = books.filter((book) => {
    const searchable = [book.title, book.author, book.genre, book.description, ...book.themes].join(" ").toLocaleLowerCase("en-US");
    const bookVariants = variants(db, book.slug);
    return (!query || searchable.includes(query)) &&
      (!parsed.data.book_type || book.book_type.toLocaleLowerCase("en-US") === parsed.data.book_type.toLocaleLowerCase("en-US")) &&
      (!parsed.data.author || book.author.toLocaleLowerCase("en-US") === parsed.data.author.toLocaleLowerCase("en-US")) &&
      (!parsed.data.genre || book.genre.toLocaleLowerCase("en-US") === parsed.data.genre.toLocaleLowerCase("en-US")) &&
      (!parsed.data.format || bookVariants.some((item) => item.format.toLocaleLowerCase("en-US") === parsed.data.format!.toLocaleLowerCase("en-US"))) &&
      (parsed.data.availability === "any" || bookVariants.some((item) => parsed.data.availability === "in_stock" ? item.inventory_quantity > 0 : item.inventory_quantity === 0));
  }).slice(0, parsed.data.limit).map((book) => catalogBook(db, book));
  return { ok: true, query: parsed.data.query ?? null, result_count: results.length, books: results };
}

function getBook(db: BooklyDatabase, rawInput: unknown) {
  const parsed = bookSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const book = findBook(parsed.data.book_id);
  return book ? { ok: true, book: catalogBook(db, book) } : { ok: false, error: { code: "BOOK_NOT_FOUND", message: "That book is not in the current catalog." } };
}

function addToCart(db: BooklyDatabase, rawInput: unknown, context: Context) {
  if (!context.sessionId) return sessionRequired();
  const parsed = addCartSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const item = db.prepare(`SELECT sku, title, format, inventory_quantity FROM catalog_items WHERE lower(book_id) = lower(?) AND lower(format) = lower(?) AND active = 1`)
    .get(parsed.data.book_id, parsed.data.format) as { sku: string; title: string; format: string; inventory_quantity: number } | undefined;
  if (!item) return { ok: false, error: { code: "CATALOG_VARIANT_NOT_FOUND", message: "That book and format combination is not available." } };
  if (item.inventory_quantity < parsed.data.quantity) {
    return { ok: false, error: { code: "OUT_OF_STOCK", message: `${item.title} (${item.format}) does not have enough inventory.`, available_quantity: item.inventory_quantity } };
  }
  const cartId = getOrCreateCart(db, context.sessionId, context.authenticatedCustomer);
  const timestamp = now();
  const existing = db.prepare("SELECT id, quantity FROM cart_items WHERE cart_id = ? AND sku = ?").get(cartId, item.sku) as { id: string; quantity: number } | undefined;
  const nextQuantity = (existing?.quantity ?? 0) + parsed.data.quantity;
  if (nextQuantity > item.inventory_quantity) return { ok: false, error: { code: "OUT_OF_STOCK", message: `Only ${item.inventory_quantity} copies are available.` } };
  if (existing) db.prepare("UPDATE cart_items SET quantity = ?, updated_at = ? WHERE id = ?").run(nextQuantity, timestamp, existing.id);
  else db.prepare("INSERT INTO cart_items (id, cart_id, sku, quantity, added_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(`cart_item_${randomUUID().replaceAll("-", "").slice(0, 14)}`, cartId, item.sku, parsed.data.quantity, timestamp, timestamp);
  return { ...cartSnapshot(db, context.sessionId, context.authenticatedCustomer), action: "added", added: { title: item.title, format: item.format, quantity: parsed.data.quantity } };
}

function updateCart(db: BooklyDatabase, rawInput: unknown, context: Context) {
  if (!context.sessionId) return sessionRequired();
  const parsed = updateCartSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const cartId = getOrCreateCart(db, context.sessionId, context.authenticatedCustomer);
  const item = db.prepare(`SELECT ci.id, p.inventory_quantity FROM cart_items ci JOIN catalog_items p ON p.sku = ci.sku WHERE ci.id = ? AND ci.cart_id = ?`)
    .get(parsed.data.cart_item_id, cartId) as { id: string; inventory_quantity: number } | undefined;
  if (!item) return { ok: false, error: { code: "CART_ITEM_NOT_FOUND", message: "That item is not in this cart." } };
  if (parsed.data.quantity > item.inventory_quantity) return { ok: false, error: { code: "OUT_OF_STOCK", message: `Only ${item.inventory_quantity} copies are available.` } };
  db.prepare("UPDATE cart_items SET quantity = ?, updated_at = ? WHERE id = ?").run(parsed.data.quantity, now(), item.id);
  return { ...cartSnapshot(db, context.sessionId, context.authenticatedCustomer), action: "updated" };
}

function removeFromCart(db: BooklyDatabase, rawInput: unknown, context: Context) {
  if (!context.sessionId) return sessionRequired();
  const parsed = removeCartSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const cartId = getOrCreateCart(db, context.sessionId, context.authenticatedCustomer);
  const result = db.prepare("DELETE FROM cart_items WHERE id = ? AND cart_id = ?").run(parsed.data.cart_item_id, cartId);
  if (!result.changes) return { ok: false, error: { code: "CART_ITEM_NOT_FOUND", message: "That item is not in this cart." } };
  return { ...cartSnapshot(db, context.sessionId, context.authenticatedCustomer), action: "removed" };
}

function clearCart(db: BooklyDatabase, rawInput: unknown, context: Context) {
  if (!context.sessionId) return sessionRequired();
  const parsed = clearCartSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.customer_confirmed) return { ok: false, error: { code: "CONFIRMATION_REQUIRED", message: "The cart was not cleared because customer confirmation is required." } };
  const cartId = getOrCreateCart(db, context.sessionId, context.authenticatedCustomer);
  db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cartId);
  return { ...cartSnapshot(db, context.sessionId, context.authenticatedCustomer), action: "cleared" };
}

function beginCheckout(db: BooklyDatabase, rawInput: unknown, context: Context) {
  if (!context.sessionId) return sessionRequired();
  if (!context.authenticatedCustomer) return authenticationRequired();
  const parsed = checkoutSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.customer_confirmed) return { ok: false, error: { code: "CONFIRMATION_REQUIRED", message: "Checkout was not started because customer confirmation is required." } };
  const snapshot = cartSnapshot(db, context.sessionId, context.authenticatedCustomer);
  if (snapshot.cart.item_count === 0) return { ok: false, error: { code: "CART_EMPTY", message: "Add at least one book before checkout." } };
  const checkoutId = `checkout_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const checkoutUrl = `/checkout/demo/${checkoutId}`;
  db.prepare("INSERT INTO checkout_sessions (id, cart_id, status, checkout_url, totals_json, created_at) VALUES (?, ?, 'ready', ?, ?, ?)")
    .run(checkoutId, snapshot.cart.cart_id, checkoutUrl, JSON.stringify(snapshot.cart), now());
  return {
    ok: true,
    checkout: {
      checkout_id: checkoutId,
      checkout_url: checkoutUrl,
      status: "ready",
      payment_collected: false,
      cart: snapshot.cart,
    },
    next_step: "Open the checkout and call review_checkout. If the customer's original request explicitly authorized checkout and payment, continue directly to submit_order after review; otherwise summarize the review and ask for confirmation.",
  };
}

function checkoutError(error: unknown) {
  if (error instanceof CheckoutError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  throw error;
}

function checkoutReviewFingerprint(review: unknown) {
  return createHash("sha256").update(JSON.stringify(review)).digest("hex");
}

function resolveCheckoutId(
  db: BooklyDatabase,
  context: Context,
  requestedCheckoutId?: string,
) {
  if (requestedCheckoutId) return requestedCheckoutId;
  return (db.prepare(`
    SELECT cs.id
    FROM checkout_sessions cs
    JOIN carts c ON c.id = cs.cart_id
    WHERE c.session_id = ? AND c.customer_id = ?
    ORDER BY cs.created_at DESC
    LIMIT 1
  `).get(context.sessionId, context.authenticatedCustomer!.id) as { id: string } | undefined)?.id;
}

function reviewCheckout(db: BooklyDatabase, rawInput: unknown, context: Context) {
  if (!context.sessionId) return sessionRequired();
  if (!context.authenticatedCustomer) return authenticationRequired();
  const parsed = checkoutActionSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const checkoutId = resolveCheckoutId(db, context, parsed.data.checkout_id);
  if (!checkoutId) {
    return { ok: false, error: { code: "CHECKOUT_NOT_FOUND", message: "There is no checkout in this signed-in browser session." } };
  }
  try {
    const review = getCheckoutReview(
      db,
      checkoutId,
      context.sessionId,
      context.authenticatedCustomer.id,
    );
    if (review.status === "paid") {
      return {
        ok: true,
        checkout: review,
        checkout_id: checkoutId,
        checkout_url: `/checkout/demo/${checkoutId}`,
        next_step: "The checkout is already paid. Confirm the order number and receipt details.",
      };
    }
    const confirmationToken = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    db.prepare("UPDATE checkout_sessions SET totals_json = ? WHERE id = ?").run(JSON.stringify({
      confirmation_token: confirmationToken,
      customer_id: context.authenticatedCustomer.id,
      review_fingerprint: checkoutReviewFingerprint(review),
      expires_at: expiresAt,
    }), checkoutId);
    return {
      ok: true,
      checkout: review,
      checkout_id: checkoutId,
      checkout_url: `/checkout/demo/${checkoutId}`,
      requires_confirmation: true,
      confirmation_token: confirmationToken,
      expires_at: expiresAt,
      next_step: "If the customer's original request explicitly authorized checkout and payment, call submit_order now with this opaque confirmation token and customer_confirmed true. Otherwise summarize the items, shipping address, saved payment method, and final total, then ask for confirmation.",
    };
  } catch (error) {
    return checkoutError(error);
  }
}

function submitOrder(db: BooklyDatabase, rawInput: unknown, context: Context) {
  if (!context.sessionId) return sessionRequired();
  if (!context.authenticatedCustomer) return authenticationRequired();
  const parsed = submitOrderSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.customer_confirmed) {
    return {
      ok: false,
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "The order was not submitted because explicit customer confirmation is required after checkout review.",
      },
    };
  }
  const checkoutId = resolveCheckoutId(db, context, parsed.data.checkout_id);
  if (!checkoutId) {
    return { ok: false, error: { code: "CHECKOUT_NOT_FOUND", message: "There is no checkout in this signed-in browser session." } };
  }
  try {
    const review = getCheckoutReview(
      db,
      checkoutId,
      context.sessionId,
      context.authenticatedCustomer.id,
    );
    if (review.status === "paid") {
      return {
        ok: true,
        already_processed: true,
        checkout_id: checkoutId,
        checkout_url: `/checkout/demo/${checkoutId}`,
        receipt: review.receipt,
      };
    }
    const authorization = db.prepare("SELECT totals_json FROM checkout_sessions WHERE id = ?").get(checkoutId) as { totals_json: string } | undefined;
    let reviewed: {
      confirmation_token?: string;
      customer_id?: number;
      review_fingerprint?: string;
      expires_at?: string;
    } | null = null;
    try {
      reviewed = authorization ? JSON.parse(authorization.totals_json) : null;
    } catch {
      reviewed = null;
    }
    if (
      reviewed?.confirmation_token !== parsed.data.confirmation_token ||
      reviewed.customer_id !== context.authenticatedCustomer.id
    ) {
      return { ok: false, error: { code: "CHECKOUT_REVIEW_REQUIRED", message: "Review the current checkout details again before submitting the order." } };
    }
    if (!reviewed.expires_at || new Date(reviewed.expires_at) < new Date()) {
      return { ok: false, error: { code: "CHECKOUT_REVIEW_EXPIRED", message: "The checkout review expired. Review the current details again before submitting." } };
    }
    if (reviewed.review_fingerprint !== checkoutReviewFingerprint(review)) {
      return { ok: false, error: { code: "CHECKOUT_CHANGED", message: "The checkout details changed after review. Review the updated order before submitting." } };
    }
    const completed = completeSimulatedCheckout(db, {
      checkoutId,
      sessionId: context.sessionId,
      customerId: context.authenticatedCustomer.id,
      paymentMethodId: review.payment_method.id,
    });
    return {
      ...completed,
      checkout_id: checkoutId,
      checkout_url: `/checkout/demo/${checkoutId}`,
    };
  } catch (error) {
    return checkoutError(error);
  }
}

function getWishlist(db: BooklyDatabase, customer?: Customer) {
  if (!customer) return authenticationRequired();
  const rows = db.prepare("SELECT book_id, created_at FROM wishlists WHERE customer_id = ? ORDER BY created_at DESC").all(customer.id) as Array<{ book_id: string; created_at: string }>;
  return { ok: true, wishlist: rows.map((row) => ({ ...catalogBook(db, findBook(row.book_id)!), added_at: row.created_at })) };
}

function addWishlist(db: BooklyDatabase, rawInput: unknown, customer?: Customer) {
  if (!customer) return authenticationRequired();
  const parsed = wishlistSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const book = findBook(parsed.data.book_id);
  if (!book) return { ok: false, error: { code: "BOOK_NOT_FOUND", message: "That book is not in the current catalog." } };
  db.prepare("INSERT OR IGNORE INTO wishlists (customer_id, book_id, created_at) VALUES (?, ?, ?)").run(customer.id, book.slug, now());
  return { ok: true, action: "added", book: { book_id: book.slug, title: book.title }, ...(getWishlist(db, customer) as { wishlist: unknown }) };
}

function removeWishlist(db: BooklyDatabase, rawInput: unknown, customer?: Customer) {
  if (!customer) return authenticationRequired();
  const parsed = wishlistSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  db.prepare("DELETE FROM wishlists WHERE customer_id = ? AND book_id = ?").run(customer.id, parsed.data.book_id);
  return { ok: true, action: "removed", ...(getWishlist(db, customer) as { wishlist: unknown }) };
}

function createStockAlert(db: BooklyDatabase, rawInput: unknown, customer?: Customer) {
  if (!customer) return authenticationRequired();
  const parsed = alertSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const item = db.prepare("SELECT sku, title, format, inventory_quantity FROM catalog_items WHERE lower(book_id) = lower(?) AND lower(format) = lower(?)")
    .get(parsed.data.book_id, parsed.data.format) as { sku: string; title: string; format: string; inventory_quantity: number } | undefined;
  if (!item) return { ok: false, error: { code: "CATALOG_VARIANT_NOT_FOUND", message: "That book and format combination does not exist." } };
  if (item.inventory_quantity > 0) return { ok: false, error: { code: "ALREADY_IN_STOCK", message: `${item.title} (${item.format}) is currently in stock.` } };
  const id = `alert_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
  db.prepare("INSERT OR IGNORE INTO stock_alerts (id, customer_id, sku, status, created_at) VALUES (?, ?, ?, 'active', ?)").run(id, customer.id, item.sku, now());
  const alert = db.prepare("SELECT id, status, created_at FROM stock_alerts WHERE customer_id = ? AND sku = ? AND status = 'active'").get(customer.id, item.sku);
  return { ok: true, alert: { ...(alert as object), title: item.title, format: item.format, notification_channel: "account_email" } };
}

export async function executeCommerceTool(db: BooklyDatabase, name: string, input: unknown, context: Context) {
  switch (name) {
    case "search_catalog": return searchCatalog(db, input);
    case "get_book": return getBook(db, input);
    case "get_cart": return context.sessionId ? cartSnapshot(db, context.sessionId, context.authenticatedCustomer) : sessionRequired();
    case "add_to_cart": return addToCart(db, input, context);
    case "update_cart_item": return updateCart(db, input, context);
    case "remove_from_cart": return removeFromCart(db, input, context);
    case "clear_cart": return clearCart(db, input, context);
    case "begin_checkout": return beginCheckout(db, input, context);
    case "review_checkout": return reviewCheckout(db, input, context);
    case "submit_order": return submitOrder(db, input, context);
    case "get_wishlist": return getWishlist(db, context.authenticatedCustomer);
    case "add_to_wishlist": return addWishlist(db, input, context.authenticatedCustomer);
    case "remove_from_wishlist": return removeWishlist(db, input, context.authenticatedCustomer);
    case "create_back_in_stock_alert": return createStockAlert(db, input, context.authenticatedCustomer);
    default: return null;
  }
}
