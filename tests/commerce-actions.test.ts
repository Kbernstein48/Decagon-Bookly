import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { openBooklyDatabase } from "../lib/database";
import { seedDatabase } from "../lib/seed";
import { executeTool } from "../lib/tools";
import { CheckoutError, completeSimulatedCheckout, getCheckoutReview } from "../lib/checkout";

process.env.BOOKLY_EMBEDDING_MODE = "local";

const maya = { authenticatedCustomer: { id: 1, email: "maya.chen@example.com", firstName: "Maya", lastName: "Chen" } };
const theo = { authenticatedCustomer: { id: 2, email: "theo.rivera@example.com", firstName: "Theo", lastName: "Rivera" } };

async function withDatabase(run: (db: ReturnType<typeof openBooklyDatabase>) => Promise<void>) {
  const db = openBooklyDatabase(":memory:");
  try {
    await seedDatabase(db);
    await run(db);
  } finally {
    db.close();
  }
}

describe("Commerce and resolution tools", () => {
  test("uses canonical variants and keeps cart mutations isolated to a browser session", async () => withDatabase(async (db) => {
    const search = await executeTool(db, "search_catalog", { query: "Glass Horizon", availability: "any" }) as {
      ok: boolean; books: Array<{ book_id: string; variants: Array<{ format: string; price: string }> }>;
    };
    assert.equal(search.ok, true);
    assert.equal(search.books[0].book_id, "a-glass-horizon");
    assert.ok(search.books[0].variants.some((variant) => variant.format === "hardcover" && variant.price === "$18.99"));

    const sessionA = { sessionId: "browser-session-a" };
    const sessionB = { sessionId: "browser-session-b" };
    const added = await executeTool(db, "add_to_cart", { book_id: "a-glass-horizon", format: "hardcover", quantity: 1 }, sessionA) as {
      ok: boolean; cart: { item_count: number; items: Array<{ cart_item_id: string }> };
    };
    assert.equal(added.ok, true);
    assert.equal(added.cart.item_count, 1);
    const itemId = added.cart.items[0].cart_item_id;

    const updated = await executeTool(db, "update_cart_item", { cart_item_id: itemId, quantity: 2 }, sessionA) as { cart: { item_count: number; total: string } };
    assert.equal(updated.cart.item_count, 2);
    assert.equal(updated.cart.total, "$37.98");

    const otherCart = await executeTool(db, "get_cart", {}, sessionB) as { cart: { item_count: number } };
    assert.equal(otherCart.cart.item_count, 0);

    const removed = await executeTool(db, "remove_from_cart", { cart_item_id: itemId }, sessionA) as { cart: { item_count: number } };
    assert.equal(removed.cart.item_count, 0);
  }));

  test("requires confirmation for checkout and never collects payment", async () => withDatabase(async (db) => {
    const context = { sessionId: "checkout-session", ...maya };
    await executeTool(db, "add_to_cart", { book_id: "the-orchard-book", format: "hardcover", quantity: 1 }, context);
    const rejected = await executeTool(db, "begin_checkout", { customer_confirmed: false }, context) as { ok: boolean; error: { code: string } };
    assert.equal(rejected.error.code, "CONFIRMATION_REQUIRED");
    const checkout = await executeTool(db, "begin_checkout", { customer_confirmed: true }, context) as {
      ok: boolean; checkout: { checkout_url: string; payment_collected: boolean; cart: { total: string } };
    };
    assert.equal(checkout.ok, true);
    assert.match(checkout.checkout.checkout_url, /^\/checkout\/demo\//);
    assert.equal(checkout.checkout.payment_collected, false);
    assert.equal(checkout.checkout.cart.total, "$34.98");
  }));

  test("lets the concierge review and submit the current checkout only after explicit confirmation", async () => withDatabase(async (db) => {
    const context = { sessionId: "concierge-checkout-session", ...maya };
    await executeTool(db, "add_to_cart", { book_id: "a-glass-horizon", format: "hardcover", quantity: 1 }, context);
    const started = await executeTool(db, "begin_checkout", { customer_confirmed: true }, context) as {
      ok: boolean; checkout: { checkout_id: string };
    };

    const skippedReview = await executeTool(db, "submit_order", {
      confirmation_token: "00000000-0000-4000-8000-000000000000",
      customer_confirmed: true,
    }, context) as { ok: boolean; error: { code: string } };
    assert.equal(skippedReview.ok, false);
    assert.equal(skippedReview.error.code, "CHECKOUT_REVIEW_REQUIRED");

    const reviewed = await executeTool(db, "review_checkout", {}, context) as {
      ok: boolean;
      checkout_id: string;
      checkout: { status: string; payment_method: { last4: string }; totals: { total: string } };
      confirmation_token: string;
    };
    assert.equal(reviewed.ok, true);
    assert.equal(reviewed.checkout_id, started.checkout.checkout_id);
    assert.equal(reviewed.checkout.status, "ready");
    assert.equal(reviewed.checkout.payment_method.last4, "4242");
    assert.equal(reviewed.checkout.totals.total, "$25.90");

    const unconfirmed = await executeTool(db, "submit_order", { confirmation_token: reviewed.confirmation_token, customer_confirmed: false }, context) as {
      ok: boolean; error: { code: string };
    };
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.error.code, "CONFIRMATION_REQUIRED");

    const submitted = await executeTool(db, "submit_order", { confirmation_token: reviewed.confirmation_token, customer_confirmed: true }, context) as {
      ok: boolean; already_processed: boolean; checkout_id: string; receipt: { order_id: string; status: string; total: string };
    };
    assert.equal(submitted.ok, true);
    assert.equal(submitted.already_processed, false);
    assert.equal(submitted.checkout_id, started.checkout.checkout_id);
    assert.equal(submitted.receipt.status, "processing");
    assert.equal(submitted.receipt.total, "$25.90");

    const duplicate = await executeTool(db, "submit_order", { checkout_id: started.checkout.checkout_id, confirmation_token: reviewed.confirmation_token, customer_confirmed: true }, context) as {
      ok: boolean; already_processed: boolean; receipt: { order_id: string };
    };
    assert.equal(duplicate.ok, true);
    assert.equal(duplicate.already_processed, true);
    assert.equal(duplicate.receipt.order_id, submitted.receipt.order_id);
  }));

  test("processes a simulated payment through the normal order path exactly once", async () => withDatabase(async (db) => {
    const context = { sessionId: "maya-checkout-session", ...maya };
    await executeTool(db, "add_to_cart", { book_id: "a-glass-horizon", format: "hardcover", quantity: 1 }, context);
    const started = await executeTool(db, "begin_checkout", { customer_confirmed: true }, context) as {
      checkout: { checkout_id: string };
    };

    const review = getCheckoutReview(db, started.checkout.checkout_id, context.sessionId, maya.authenticatedCustomer.id);
    assert.equal(review.status, "ready");
    if (review.status !== "ready") return;
    assert.equal(review.customer.email, "maya.chen@example.com");
    assert.equal(review.payment_method.last4, "4242");
    assert.equal(review.shipping_address.address2, "Apt 3");
    assert.deepEqual(review.totals, { subtotal: "$18.99", shipping: "$4.99", tax: "$1.92", total: "$25.90" });

    const inventoryBefore = db.prepare("SELECT inventory_quantity FROM catalog_items WHERE sku = ?").get("BKL-A-GLASS-HORIZON-HARDCOVER") as { inventory_quantity: number };
    const completed = completeSimulatedCheckout(db, {
      checkoutId: started.checkout.checkout_id,
      sessionId: context.sessionId,
      customerId: maya.authenticatedCustomer.id,
      paymentMethodId: review.payment_method.id,
    });
    assert.equal(completed.ok, true);
    assert.equal(completed.already_processed, false);
    assert.equal(completed.receipt.status, "processing");
    assert.equal(completed.receipt.total, "$25.90");
    assert.equal(completed.receipt.payment?.status, "succeeded");
    assert.equal(completed.receipt.payment?.simulated, true);

    const order = db.prepare("SELECT customer_id, status, total_cents FROM orders WHERE id = ?").get(completed.receipt.order_id) as {
      customer_id: number; status: string; total_cents: number;
    };
    const lineCount = db.prepare("SELECT COUNT(*) AS count FROM order_lines WHERE order_id = ?").get(completed.receipt.order_id) as { count: number };
    const paymentCount = db.prepare("SELECT COUNT(*) AS count FROM payments WHERE order_id = ?").get(completed.receipt.order_id) as { count: number };
    const cart = db.prepare("SELECT status FROM carts WHERE session_id = ?").get(context.sessionId) as { status: string };
    const checkout = db.prepare("SELECT status, order_id, payment_id, paid_at FROM checkout_sessions WHERE id = ?").get(started.checkout.checkout_id) as {
      status: string; order_id: string; payment_id: string; paid_at: string;
    };
    const inventoryAfter = db.prepare("SELECT inventory_quantity FROM catalog_items WHERE sku = ?").get("BKL-A-GLASS-HORIZON-HARDCOVER") as { inventory_quantity: number };
    assert.deepEqual(order, { customer_id: 1, status: "processing", total_cents: 2590 });
    assert.equal(lineCount.count, 1);
    assert.equal(paymentCount.count, 1);
    assert.equal(cart.status, "purchased");
    assert.equal(checkout.status, "paid");
    assert.equal(checkout.order_id, completed.receipt.order_id);
    assert.ok(checkout.payment_id);
    assert.ok(checkout.paid_at);
    assert.equal(inventoryAfter.inventory_quantity, inventoryBefore.inventory_quantity - 1);

    const duplicate = completeSimulatedCheckout(db, {
      checkoutId: started.checkout.checkout_id,
      sessionId: context.sessionId,
      customerId: maya.authenticatedCustomer.id,
      paymentMethodId: review.payment_method.id,
    });
    assert.equal(duplicate.already_processed, true);
    assert.equal(duplicate.receipt.order_id, completed.receipt.order_id);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM payments WHERE checkout_id = ?").get(started.checkout.checkout_id) as { count: number }).count, 1);
  }));

  test("rejects checkout payment from a different browser session", async () => withDatabase(async (db) => {
    const context = { sessionId: "maya-owner-session", ...maya };
    await executeTool(db, "add_to_cart", { book_id: "the-orchard-book", format: "hardcover", quantity: 1 }, context);
    const started = await executeTool(db, "begin_checkout", { customer_confirmed: true }, context) as {
      checkout: { checkout_id: string };
    };
    assert.throws(
      () => getCheckoutReview(db, started.checkout.checkout_id, "different-session", maya.authenticatedCustomer.id),
      (error: unknown) => error instanceof CheckoutError && error.code === "CHECKOUT_NOT_AVAILABLE",
    );
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM payments").get() as { count: number }).count, 0);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count, 3);
  }));

  test("persists wishlist items and creates alerts only for unavailable variants", async () => withDatabase(async (db) => {
    const saved = await executeTool(db, "add_to_wishlist", { book_id: "the-night-cartographer" }, maya) as { ok: boolean; wishlist: unknown[] };
    assert.equal(saved.ok, true);
    assert.equal(saved.wishlist.length, 1);

    const alert = await executeTool(db, "create_back_in_stock_alert", { book_id: "the-night-cartographer", format: "audiobook" }, maya) as {
      ok: boolean; alert: { status: string; notification_channel: string };
    };
    assert.equal(alert.ok, true);
    assert.equal(alert.alert.status, "active");
    assert.equal(alert.alert.notification_channel, "account_email");

    const inStock = await executeTool(db, "create_back_in_stock_alert", { book_id: "the-night-cartographer", format: "hardcover" }, maya) as { ok: boolean; error: { code: string } };
    assert.equal(inStock.error.code, "ALREADY_IN_STOCK");
  }));

  test("guards processing-order cancellation and address changes with one-time quotes", async () => withDatabase(async (db) => {
    const checked = await executeTool(db, "check_order_modification_eligibility", { order_id: "2468", action: "cancel" }, theo) as {
      ok: boolean; eligible: boolean; confirmation_token: string;
    };
    assert.equal(checked.eligible, true);
    const cancelled = await executeTool(db, "cancel_order", { confirmation_token: checked.confirmation_token, customer_confirmed: true }, theo) as { order: { status: string } };
    assert.equal(cancelled.order.status, "cancelled");
    const duplicate = await executeTool(db, "cancel_order", { confirmation_token: checked.confirmation_token, customer_confirmed: true }, theo) as { error: { code: string } };
    assert.equal(duplicate.error.code, "ACTION_QUOTE_ALREADY_USED");
  }));

  test("updates a processing order address only after confirmation", async () => withDatabase(async (db) => {
    const newAddress = { address1: "500 Congress Ave", address2: "Suite 20", city: "Austin", state: "TX", postal_code: "78701" };
    const checked = await executeTool(db, "check_order_modification_eligibility", { order_id: "2468", action: "update_shipping_address", new_address: newAddress }, theo) as { confirmation_token: string };
    const updated = await executeTool(db, "update_shipping_address", { confirmation_token: checked.confirmation_token, customer_confirmed: true }, theo) as {
      ok: boolean; order: { shipping_address: typeof newAddress };
    };
    assert.equal(updated.ok, true);
    assert.deepEqual(updated.order.shipping_address, newAddress);
  }));

  test("creates a confirmed replacement and prepaid return label", async () => withDatabase(async (db) => {
    const prepared = await executeTool(db, "prepare_replacement", {
      order_id: "5678", items: [{ order_line_id: 2001, quantity: 1 }], reason: "The delivered book arrived water damaged.",
    }, maya) as { confirmation_token: string };
    const replacement = await executeTool(db, "create_replacement", { confirmation_token: prepared.confirmation_token, customer_confirmed: true }, maya) as {
      ok: boolean; replacement: { status: string; charge: string };
    };
    assert.equal(replacement.ok, true);
    assert.equal(replacement.replacement.status, "processing");
    assert.equal(replacement.replacement.charge, "$0.00");

    const returned = await executeTool(db, "create_return_label", {
      order_id: "5678", items: [{ order_line_id: 2002, quantity: 1 }], return_method: "qr_code", customer_confirmed: true,
    }, maya) as {
      ok: boolean;
      return: {
        return_id: string;
        prepaid: boolean;
        qr_code: string;
        carrier: { name: string; service: string; carrier_reference: string };
        drop_off: { printer_required: boolean; packaging_required: boolean; location_types: string[] };
      };
    };
    assert.equal(returned.ok, true);
    assert.equal(returned.return.prepaid, true);
    assert.match(returned.return.qr_code, /^BOOKLY\|UPS_RETURN\|RET_[A-F0-9]{14}\|1ZBKL[A-F0-9]{13}$/);
    assert.equal(returned.return.carrier.name, "UPS");
    assert.equal(returned.return.carrier.service, "UPS Returns");
    assert.match(returned.return.carrier.carrier_reference, /^1ZBKL[A-F0-9]{13}$/);
    assert.equal(returned.return.drop_off.printer_required, false);
    assert.equal(returned.return.drop_off.packaging_required, true);
    assert.ok(returned.return.drop_off.location_types.includes("The UPS Store"));
    const status = await executeTool(db, "get_return_status", { return_id: returned.return.return_id }, maya) as { return: { status: string; items: unknown[]; carrier: { name: string } } };
    assert.equal(status.return.status, "label_created");
    assert.equal(status.return.items.length, 1);
    assert.equal(status.return.carrier.name, "UPS");
  }));

  test("creates an evidence-rich support case before human handoff", async () => withDatabase(async (db) => {
    const created = await executeTool(db, "create_support_case", {
      category: "shipping",
      summary: "Order 5678 is marked delivered but remains missing after all location checks.",
      priority: "high",
      order_id: "5678",
      conversation_excerpt: "Customer checked household members, neighbors, porch, mailroom, and package lockers.",
    }, maya) as { ok: boolean; case: { case_id: string; status: string } };
    assert.equal(created.case.status, "open");
    const handoff = await executeTool(db, "handoff_to_agent", { case_id: created.case.case_id }, maya) as {
      ok: boolean; handoff: { status: string; estimated_wait: string };
    };
    assert.equal(handoff.ok, true);
    assert.equal(handoff.handoff.status, "queued_for_agent");
    assert.equal(handoff.handoff.estimated_wait, "within 1 business hour");
  }));
});
