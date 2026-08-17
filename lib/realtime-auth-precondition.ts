export const AUTHENTICATION_PROMPT_MESSAGE =
  "This action requires you to sign in. Please complete the form below, and I'll continue automatically.";

export const AUTHENTICATION_PRECONDITION_METADATA_KEY = "authentication_precondition_id";

export const AUTHENTICATED_TOOL_NAMES = new Set([
  "begin_checkout",
  "review_checkout",
  "submit_order",
  "lookup_order",
  "investigate_shipment",
  "open_shipping_investigation",
  "prepare_refund",
  "process_refund",
  "get_wishlist",
  "add_to_wishlist",
  "remove_from_wishlist",
  "create_back_in_stock_alert",
  "check_order_modification_eligibility",
  "cancel_order",
  "update_shipping_address",
  "prepare_replacement",
  "create_replacement",
  "create_return_label",
  "get_return_status",
  "create_support_case",
  "handoff_to_agent",
]);

export function requiresCustomerAuthentication(toolName: string) {
  return AUTHENTICATED_TOOL_NAMES.has(toolName);
}

/**
 * Creates an isolated Realtime response whose only job is to narrate the
 * authentication precondition. It cannot call tools or consume the pending
 * function call, and metadata lets the client wait for response.done.
 */
export function authenticationNarrationEvent(requestId: string, voice: boolean) {
  return {
    type: "response.create",
    response: {
      conversation: "none",
      metadata: { [AUTHENTICATION_PRECONDITION_METADATA_KEY]: requestId },
      input: [],
      instructions: `Say exactly this sentence and nothing else: "${AUTHENTICATION_PROMPT_MESSAGE}"`,
      output_modalities: [voice ? "audio" : "text"],
      tools: [],
      tool_choice: "none",
    },
  };
}
