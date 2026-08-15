import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { BooklyDatabase } from "../lib/database";
import { openBooklyDatabase } from "../lib/database";
import { getHistory, saveMessage, saveToolRun } from "../lib/history";
import { resetDatabaseToDemoBaseline, seedDatabase } from "../lib/seed";
import { executeTool } from "../lib/tools";

process.env.BOOKLY_EMBEDDING_MODE = "local";

describe("Demo database reset", () => {
  let db: BooklyDatabase;
  const maya = { authenticatedCustomer: { id: 1, email: "maya.chen@example.com", firstName: "Maya", lastName: "Chen" } };

  before(async () => {
    db = openBooklyDatabase(":memory:");
    await seedDatabase(db);
  });

  after(() => db.close());

  test("restores commerce data and clears conversation state", async () => {
    const prepared = await executeTool(db, "prepare_refund", {
      order_id: "5678",
      items: [{ order_line_id: 2001, quantity: 1 }],
      reason: "Demo reset verification",
    }, maya) as { confirmation_token: string };
    await executeTool(db, "process_refund", {
      confirmation_token: prepared.confirmation_token,
      customer_confirmed: true,
    }, maya);
    const shipmentDiagnostic = await executeTool(db, "investigate_shipment", {
      order_id: "5678",
      issue_type: "delivered_not_received",
      description: "I checked the porch, household members, and neighbors but the shipment is missing.",
      preliminary_checks_completed: true,
    }, maya) as { investigation: { confirmation_token: string } };
    await executeTool(db, "open_shipping_investigation", {
      confirmation_token: shipmentDiagnostic.investigation.confirmation_token,
      customer_confirmed: true,
    }, maya);
    const mayaSession = { ...maya, sessionId: "reset-browser-session" };
    await executeTool(db, "add_to_cart", { book_id: "a-glass-horizon", format: "hardcover", quantity: 1 }, mayaSession);
    await executeTool(db, "add_to_wishlist", { book_id: "salt-letters" }, maya);
    await executeTool(db, "create_back_in_stock_alert", { book_id: "the-night-cartographer", format: "audiobook" }, maya);
    const replacementQuote = await executeTool(db, "prepare_replacement", {
      order_id: "5678", items: [{ order_line_id: 2002, quantity: 1 }], reason: "Reset test replacement",
    }, maya) as { confirmation_token: string };
    await executeTool(db, "create_replacement", { confirmation_token: replacementQuote.confirmation_token, customer_confirmed: true }, maya);
    await executeTool(db, "create_return_label", {
      order_id: "5678", items: [{ order_line_id: 2002, quantity: 1 }], return_method: "qr_code", customer_confirmed: true,
    }, maya);
    await executeTool(db, "create_support_case", {
      category: "other", summary: "Reset verification support case.", priority: "normal", conversation_excerpt: "Please verify reset behavior.",
    }, maya);

    const openCasesBeforeReset = db.prepare("SELECT COUNT(*) AS count FROM shipping_investigations").get() as { count: number };
    assert.equal(openCasesBeforeReset.count, 1);

    saveMessage(db, {
      id: "reset-test-message",
      sessionId: "reset-test-session",
      role: "user",
      content: "Please reset the demo.",
      modality: "text",
    });
    saveToolRun(db, {
      sessionId: "reset-test-session",
      callId: "reset-test-call",
      toolName: "lookup_order",
      toolInput: { order_id: "5678" },
      toolOutput: { ok: true },
      status: "completed",
      durationMs: 1,
    });

    const restored = await resetDatabaseToDemoBaseline(db) as unknown as {
      orders: number;
      refunds: number;
      messages: number;
      tool_runs: number;
      shipping_investigations: number;
      shipment_events: number;
      carts: number;
      replacements: number;
      returns: number;
      support_cases: number;
      catalog_items: number;
      policy_chunks: number;
      book_documents: number;
      knowledge_documents: number;
    };
    const order = await executeTool(db, "lookup_order", {
      order_id: "5678",
    }, maya) as {
      ok: boolean;
      order: { status: string; lines: Array<{ quantity: number; refundable_quantity: number }> };
    };

    assert.equal(restored.orders, 3);
    assert.equal(restored.refunds, 0);
    assert.equal(restored.messages, 0);
    assert.equal(restored.tool_runs, 0);
    assert.equal(restored.shipping_investigations, 0);
    assert.equal(restored.shipment_events, 7);
    assert.equal(restored.carts, 0);
    assert.equal(restored.replacements, 0);
    assert.equal(restored.returns, 0);
    assert.equal(restored.support_cases, 0);
    assert.equal(restored.catalog_items, 19);
    assert.equal(restored.policy_chunks, 22);
    assert.equal(restored.book_documents, 8);
    assert.equal(restored.knowledge_documents, 30);
    assert.equal(order.ok, true);
    assert.equal(order.order.status, "delivered");
    assert.ok(order.order.lines.every((line) => line.refundable_quantity === line.quantity));
    assert.deepEqual(getHistory(db, "reset-test-session"), { messages: [], toolRuns: [] });
  });
});
