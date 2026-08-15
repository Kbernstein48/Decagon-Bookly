import { randomUUID } from "node:crypto";
import type { BooklyDatabase } from "./database";

const TAX_RATE = 0.08;

type CheckoutRow = {
  id: string;
  cart_id: string;
  cart_status: string;
  session_id: string;
  customer_id: number | null;
  status: string;
  order_id: string | null;
  payment_id: string | null;
  paid_at: string | null;
};

type CartItemRow = {
  cart_item_id: string;
  sku: string;
  title: string;
  author: string;
  format: string;
  quantity: number;
  price_cents: number;
  inventory_quantity: number;
};

type PaymentMethodRow = {
  id: string;
  brand: string;
  last4: string;
  expiry_month: number;
  expiry_year: number;
  cardholder_name: string;
  billing_address1: string;
  billing_address2: string | null;
  billing_city: string;
  billing_state: string;
  billing_postal_code: string;
};

type CustomerRow = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
};

export class CheckoutError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

const money = (cents: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
}).format(cents / 100);

function checkoutRow(db: BooklyDatabase, checkoutId: string) {
  return db.prepare(`
    SELECT cs.id, cs.cart_id, cs.status, cs.order_id, cs.payment_id, cs.paid_at,
           c.status AS cart_status, c.session_id, c.customer_id
    FROM checkout_sessions cs
    JOIN carts c ON c.id = cs.cart_id
    WHERE cs.id = ?
  `).get(checkoutId) as CheckoutRow | undefined;
}

function assertCheckoutOwner(row: CheckoutRow | undefined, sessionId: string, customerId: number) {
  if (!row) throw new CheckoutError("CHECKOUT_NOT_FOUND", "This checkout link is no longer available.", 404);
  if (row.session_id !== sessionId || row.customer_id !== customerId) {
    throw new CheckoutError("CHECKOUT_NOT_AVAILABLE", "This checkout belongs to a different signed-in session.", 403);
  }
  return row;
}

function cartItems(db: BooklyDatabase, cartId: string) {
  return db.prepare(`
    SELECT ci.id AS cart_item_id, ci.sku, ci.quantity, p.title, p.author,
           p.format, p.price_cents, p.inventory_quantity
    FROM cart_items ci
    JOIN catalog_items p ON p.sku = ci.sku
    WHERE ci.cart_id = ?
    ORDER BY ci.added_at, ci.id
  `).all(cartId) as CartItemRow[];
}

function defaultPaymentMethod(db: BooklyDatabase, customerId: number, paymentMethodId?: string) {
  const method = db.prepare(`
    SELECT id, brand, last4, expiry_month, expiry_year, cardholder_name,
           billing_address1, billing_address2, billing_city, billing_state,
           billing_postal_code
    FROM customer_payment_methods
    WHERE customer_id = ? AND (? IS NULL OR id = ?)
    ORDER BY is_default DESC, created_at
    LIMIT 1
  `).get(customerId, paymentMethodId ?? null, paymentMethodId ?? null) as PaymentMethodRow | undefined;
  if (!method) throw new CheckoutError("PAYMENT_METHOD_NOT_FOUND", "The saved demo payment method is unavailable.", 400);
  return method;
}

function customer(db: BooklyDatabase, customerId: number) {
  const row = db.prepare(`
    SELECT id, email, first_name, last_name FROM customers WHERE id = ?
  `).get(customerId) as CustomerRow | undefined;
  if (!row) throw new CheckoutError("CUSTOMER_NOT_FOUND", "The signed-in account is unavailable.", 403);
  return row;
}

function totals(items: CartItemRow[]) {
  const subtotalCents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const shippingCents = items.length === 0 || subtotalCents >= 3500 ? 0 : 499;
  const taxCents = Math.round((subtotalCents + shippingCents) * TAX_RATE);
  return {
    subtotal_cents: subtotalCents,
    shipping_cents: shippingCents,
    tax_cents: taxCents,
    total_cents: subtotalCents + shippingCents + taxCents,
  };
}

function orderReceipt(db: BooklyDatabase, orderId: string) {
  const order = db.prepare(`
    SELECT id, status, placed_at, estimated_delivery, subtotal_cents,
           shipping_cents, tax_cents, total_cents, currency
    FROM orders WHERE id = ?
  `).get(orderId) as {
    id: string;
    status: string;
    placed_at: string;
    estimated_delivery: string | null;
    subtotal_cents: number;
    shipping_cents: number;
    tax_cents: number;
    total_cents: number;
    currency: string;
  } | undefined;
  if (!order) throw new CheckoutError("ORDER_NOT_FOUND", "The completed order could not be loaded.", 500);
  const payment = db.prepare(`
    SELECT id, status, payment_reference, payment_method_brand,
           payment_method_last4, created_at
    FROM payments WHERE order_id = ?
  `).get(orderId) as {
    id: string;
    status: string;
    payment_reference: string;
    payment_method_brand: string;
    payment_method_last4: string;
    created_at: string;
  } | undefined;
  return {
    order_id: order.id,
    status: order.status,
    placed_at: order.placed_at,
    estimated_delivery: order.estimated_delivery,
    subtotal: money(order.subtotal_cents),
    shipping: order.shipping_cents === 0 ? "Free" : money(order.shipping_cents),
    tax: money(order.tax_cents),
    total: money(order.total_cents),
    currency: order.currency,
    payment: payment ? {
      payment_id: payment.id,
      status: payment.status,
      reference: payment.payment_reference,
      method: `${payment.payment_method_brand} ending in ${payment.payment_method_last4}`,
      paid_at: payment.created_at,
      simulated: true,
    } : null,
  };
}

export function getCheckoutReview(
  db: BooklyDatabase,
  checkoutId: string,
  sessionId: string,
  customerId: number,
) {
  const checkout = assertCheckoutOwner(checkoutRow(db, checkoutId), sessionId, customerId);
  if (checkout.status === "paid" && checkout.order_id) {
    return { status: "paid" as const, receipt: orderReceipt(db, checkout.order_id) };
  }
  if (checkout.status !== "ready" || checkout.cart_status !== "active") {
    throw new CheckoutError("CHECKOUT_NOT_READY", "This checkout can no longer accept payment.", 409);
  }

  const items = cartItems(db, checkout.cart_id);
  if (items.length === 0) throw new CheckoutError("CART_EMPTY", "There are no books in this checkout.", 409);
  const account = customer(db, customerId);
  const method = defaultPaymentMethod(db, customerId);
  const calculated = totals(items);

  return {
    status: "ready" as const,
    checkout_id: checkout.id,
    customer: {
      first_name: account.first_name,
      last_name: account.last_name,
      email: account.email,
    },
    items: items.map((item) => ({
      cart_item_id: item.cart_item_id,
      title: item.title,
      author: item.author,
      format: item.format,
      quantity: item.quantity,
      unit_price: money(item.price_cents),
      line_total: money(item.price_cents * item.quantity),
    })),
    totals: {
      subtotal: money(calculated.subtotal_cents),
      shipping: calculated.shipping_cents === 0 ? "Free" : money(calculated.shipping_cents),
      tax: money(calculated.tax_cents),
      total: money(calculated.total_cents),
    },
    payment_method: {
      id: method.id,
      brand: method.brand,
      last4: method.last4,
      display_number: method.last4 === "4242" ? "4242 4242 4242 4242" : `•••• •••• •••• ${method.last4}`,
      expiry: `${String(method.expiry_month).padStart(2, "0")}/${String(method.expiry_year).slice(-2)}`,
      cardholder_name: method.cardholder_name,
    },
    shipping_address: {
      name: `${account.first_name} ${account.last_name}`,
      address1: method.billing_address1,
      address2: method.billing_address2,
      city: method.billing_city,
      state: method.billing_state,
      postal_code: method.billing_postal_code,
    },
  };
}

function nextOrderId(db: BooklyDatabase) {
  const result = db.prepare(`
    SELECT COALESCE(MAX(CASE WHEN id GLOB '[0-9]*' THEN CAST(id AS INTEGER) END), 9999) + 1 AS id
    FROM orders
  `).get() as { id: number };
  return String(result.id);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function completeSimulatedCheckout(
  db: BooklyDatabase,
  input: {
    checkoutId: string;
    sessionId: string;
    customerId: number;
    paymentMethodId: string;
  },
) {
  return db.transaction(() => {
    const checkout = assertCheckoutOwner(
      checkoutRow(db, input.checkoutId),
      input.sessionId,
      input.customerId,
    );
    if (checkout.status === "paid" && checkout.order_id) {
      return { ok: true, already_processed: true, receipt: orderReceipt(db, checkout.order_id) };
    }
    if (checkout.status !== "ready" || checkout.cart_status !== "active") {
      throw new CheckoutError("CHECKOUT_NOT_READY", "This checkout can no longer accept payment.", 409);
    }

    const items = cartItems(db, checkout.cart_id);
    if (items.length === 0) throw new CheckoutError("CART_EMPTY", "There are no books in this checkout.", 409);
    for (const item of items) {
      if (item.inventory_quantity < item.quantity) {
        throw new CheckoutError(
          "INSUFFICIENT_STOCK",
          `${item.title} no longer has enough inventory for this order.`,
          409,
        );
      }
    }

    const account = customer(db, input.customerId);
    const method = defaultPaymentMethod(db, input.customerId, input.paymentMethodId);
    const calculated = totals(items);
    const timestamp = new Date();
    const placedAt = timestamp.toISOString();
    const orderId = nextOrderId(db);
    const paymentId = `pay_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
    const paymentReference = `sim_${randomUUID().replaceAll("-", "").slice(0, 20)}`;

    db.prepare(`
      INSERT INTO orders (
        id, customer_id, status, placed_at, estimated_delivery,
        subtotal_cents, shipping_cents, tax_cents, total_cents, currency,
        shipping_city, shipping_state, shipping_address1, shipping_address2,
        shipping_postal_code, updated_at
      ) VALUES (?, ?, 'processing', ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      account.id,
      placedAt,
      addDays(timestamp, 7),
      calculated.subtotal_cents,
      calculated.shipping_cents,
      calculated.tax_cents,
      calculated.total_cents,
      method.billing_city,
      method.billing_state,
      method.billing_address1,
      method.billing_address2,
      method.billing_postal_code,
      placedAt,
    );

    const maxLine = db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM order_lines").get() as { id: number };
    const insertLine = db.prepare(`
      INSERT INTO order_lines (
        id, order_id, sku, title, author, product_type, quantity,
        refunded_quantity, unit_price_cents, fulfillment_status,
        refundable_until, is_final_sale
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'processing', NULL, 0)
    `);
    const decrementInventory = db.prepare(`
      UPDATE catalog_items
      SET inventory_quantity = inventory_quantity - ?
      WHERE sku = ? AND inventory_quantity >= ?
    `);
    items.forEach((item, index) => {
      insertLine.run(
        maxLine.id + index + 1,
        orderId,
        item.sku,
        item.title,
        item.author,
        item.format === "ebook" || item.format === "audiobook" ? "digital" : "physical",
        item.quantity,
        item.price_cents,
      );
      const inventoryUpdate = decrementInventory.run(item.quantity, item.sku, item.quantity);
      if (inventoryUpdate.changes !== 1) {
        throw new CheckoutError("INSUFFICIENT_STOCK", `${item.title} no longer has enough inventory for this order.`, 409);
      }
    });

    db.prepare(`
      INSERT INTO payments (
        id, order_id, checkout_id, customer_id, status, amount_cents,
        currency, processor, payment_reference, payment_method_brand,
        payment_method_last4, created_at
      ) VALUES (?, ?, ?, ?, 'succeeded', ?, 'USD', 'bookly_simulator', ?, ?, ?, ?)
    `).run(
      paymentId,
      orderId,
      checkout.id,
      account.id,
      calculated.total_cents,
      paymentReference,
      method.brand,
      method.last4,
      placedAt,
    );

    db.prepare("UPDATE carts SET status = 'purchased', updated_at = ? WHERE id = ?")
      .run(placedAt, checkout.cart_id);
    db.prepare(`
      UPDATE checkout_sessions
      SET status = 'paid', order_id = ?, payment_id = ?, paid_at = ?
      WHERE id = ?
    `).run(orderId, paymentId, placedAt, checkout.id);

    return { ok: true, already_processed: false, receipt: orderReceipt(db, orderId) };
  })();
}
