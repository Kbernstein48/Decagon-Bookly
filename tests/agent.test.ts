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

  test("uses an application authentication precondition instead of model-provided identity", () => {
    const session = realtimeSessionConfig();
    const lookupTool = session.tools.find((tool) => tool.name === "lookup_order");
    assert.equal(session.tools.some((tool) => (tool.name as string) === "authenticate_customer"), false);
    assert.ok(lookupTool);
    assert.equal("email" in lookupTool.parameters.properties, false);
    assert.deepEqual(lookupTool.parameters.required, ["order_id"]);
    assert.match(session.instructions, /Never ask the customer to type their email/i);
    assert.match(session.instructions, /application-enforced precondition on every account tool/i);
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

  test("loads the refund policy before any other refund workflow action", () => {
    const session = realtimeSessionConfig();
    const knowledgeTool = session.tools.find((tool) => tool.name === "search_knowledge");
    const prepareRefundTool = session.tools.find((tool) => tool.name === "prepare_refund");
    assert.ok(knowledgeTool);
    assert.ok(prepareRefundTool);
    assert.match(
      session.instructions,
      /Whenever the customer asks to start, pursue, or process a refund[\s\S]*first action must always be to call search_knowledge with filter set to policy/i,
    );
    assert.match(
      session.instructions,
      /before lookup_order[\s\S]*before asking for refund details[\s\S]*before prepare_refund/i,
    );
    assert.match(knowledgeTool.description, /first tool called for every new refund request/i);
    assert.match(prepareRefundTool.description, /call search_knowledge with filter='policy' first/i);
  });

  test("opens one named catalog book beside the chat", () => {
    const session = realtimeSessionConfig();
    const openBookTool = session.tools.find((tool) => tool.name === "open_book");
    assert.ok(openBookTool);
    assert.deepEqual(openBookTool.parameters.required, ["title"]);
    assert.equal(openBookTool.parameters.properties.title.type, "string");
    assert.match(session.instructions, /one specific, named book[\s\S]*open_book with the exact catalog title/i);
    assert.match(session.instructions, /non-blocking book detail window/i);
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
    assert.match(session.instructions, /explicitly asks to check out and pay[\s\S]*submit_order/i);
    assert.match(session.instructions, /resumes the same tool call automatically/i);
    assert.match(session.instructions, /two-step actions/i);
  });
});
