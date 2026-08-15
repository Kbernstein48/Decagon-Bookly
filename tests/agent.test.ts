import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { realtimeSessionConfig } from "../lib/agent";

describe("Realtime voice configuration", () => {
  test("automatically detects completed turns and supports interruption", () => {
    const session = realtimeSessionConfig();
    assert.deepEqual(session.audio.input.turn_detection, {
      type: "semantic_vad",
      eagerness: "medium",
      create_response: true,
      interrupt_response: true,
    });
  });

  test("uses an explicit authentication tool instead of model-provided email", () => {
    const session = realtimeSessionConfig();
    const authTool = session.tools.find((tool) => tool.name === "authenticate_customer");
    const lookupTool = session.tools.find((tool) => tool.name === "lookup_order");
    assert.ok(authTool);
    assert.ok(lookupTool);
    assert.equal("email" in lookupTool.parameters.properties, false);
    assert.deepEqual(lookupTool.parameters.required, []);
    assert.match(session.instructions, /Never ask the customer to type their email/i);
    assert.match(session.instructions, /without one to securely retrieve the signed-in account's recent orders/i);
  });

  test("requires an explicit books or policy knowledge filter", () => {
    const session = realtimeSessionConfig();
    const knowledgeTool = session.tools.find((tool) => tool.name === "search_knowledge");
    assert.ok(knowledgeTool);
    assert.ok(knowledgeTool.parameters.required.includes("filter"));
    assert.deepEqual(knowledgeTool.parameters.properties.filter.enum, ["books", "policy"]);
    assert.match(session.instructions, /questions about books[\s\S]*filter set to books/i);
    assert.match(session.instructions, /policy questions[\s\S]*filter set to policy/i);
  });

  test("opens one or more named catalog books beside the chat", () => {
    const session = realtimeSessionConfig();
    const openBookTool = session.tools.find((tool) => tool.name === "open_book");
    assert.ok(openBookTool);
    assert.deepEqual(openBookTool.parameters.required, ["titles"]);
    assert.equal(openBookTool.parameters.properties.titles.type, "array");
    assert.equal(openBookTool.parameters.properties.titles.maxItems, 8);
    assert.match(session.instructions, /books by one author[\s\S]*Include every matching catalog title in one call/i);
    assert.match(session.instructions, /one non-blocking detail card per title/i);
  });

  test("exposes small typed commerce and resolution actions", () => {
    const session = realtimeSessionConfig();
    const names = new Set<string>(session.tools.map((tool) => tool.name));
    for (const name of [
      "search_catalog", "get_cart", "add_to_cart", "update_cart_item", "remove_from_cart", "clear_cart", "begin_checkout", "review_checkout", "submit_order",
      "check_order_modification_eligibility", "cancel_order", "update_shipping_address", "prepare_replacement", "create_replacement",
      "create_return_label", "create_support_case", "handoff_to_agent", "add_to_wishlist", "create_back_in_stock_alert",
    ]) assert.ok(names.has(name), `missing ${name}`);
    const submitOrder = session.tools.find((tool) => tool.name === "submit_order");
    assert.ok(submitOrder?.parameters.required.includes("confirmation_token"));
    assert.ok(submitOrder?.parameters.required.includes("customer_confirmed"));
    assert.match(session.instructions, /Only then call submit_order/i);
    assert.match(session.instructions, /two-step actions/i);
  });
});
