/**
 * Bookly Concierge realtime agent configuration.
 *
 * Defines the model, system instructions, tool schemas, and the session
 * config object passed to OpenAI Realtime when starting a voice/chat session.
 */

/** Realtime model used for Bookly Concierge sessions. */
export const BOOKLY_MODEL = "gpt-realtime-2.1";

import { booklyAgentInstructions } from "@/lib/agent-instructions";

export { BOOKLY_AGENT_INSTRUCTIONS } from "@/lib/agent-instructions";

/**
 * Function-tool schemas exposed to the realtime model.
 *
 * Grouped roughly by domain: catalog/cart → account/auth → orders →
 * refunds/returns → support handoff → shipping → knowledge/UI helpers.
 * Implementations live elsewhere; this file only declares the contract.
 *
 * 
 */
export const BOOKLY_TOOLS = [
  // --- Catalog & cart (no sign-in required for cart) ---
  {
    type: "function",
    name: "search_catalog",
    description: "Search authoritative purchasable catalog records with exact book IDs, formats, prices, inventory, and availability. Use before cart, wishlist, or stock-alert actions.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        query: { type: "string" }, book_type: { type: "string" }, author: { type: "string" }, genre: { type: "string" },
        format: { type: "string" }, availability: { type: "string", enum: ["in_stock", "out_of_stock", "any"] },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      }, required: [],
    },
  },
  {
    type: "function", name: "get_book", description: "Get one authoritative catalog book and all purchasable variants by exact book_id.",
    parameters: { type: "object", additionalProperties: false, properties: { book_id: { type: "string" } }, required: ["book_id"] },
  },
  {
    type: "function", name: "get_cart", description: "Read the current browser-session cart, including item IDs, formats, quantities, totals, and free-shipping progress.",
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: "function", name: "add_to_cart", description: "Add an exact catalog book format to the current cart. Resolve book_id and format through search_catalog first.",
    parameters: { type: "object", additionalProperties: false, properties: { book_id: { type: "string" }, format: { type: "string" }, quantity: { type: "integer", minimum: 1, maximum: 20 } }, required: ["book_id", "format", "quantity"] },
  },
  {
    type: "function", name: "update_cart_item", description: "Set the quantity of one exact cart item. Read get_cart first to obtain cart_item_id.",
    parameters: { type: "object", additionalProperties: false, properties: { cart_item_id: { type: "string" }, quantity: { type: "integer", minimum: 1, maximum: 20 } }, required: ["cart_item_id", "quantity"] },
  },
  {
    type: "function", name: "remove_from_cart", description: "Remove one exact item from the cart. Read get_cart first to obtain cart_item_id.",
    parameters: { type: "object", additionalProperties: false, properties: { cart_item_id: { type: "string" } }, required: ["cart_item_id"] },
  },
  {
    type: "function", name: "clear_cart", description: "Clear every cart item only after explicit customer confirmation in a later message.",
    parameters: { type: "object", additionalProperties: false, properties: { customer_confirmed: { type: "boolean" } }, required: ["customer_confirmed"] },
  },
  {
    type: "function", name: "begin_checkout", description: "Create and open the signed-in customer's checkout page after explicit confirmation. If the customer explicitly asked to check out and pay, continue with review_checkout and submit_order in the same workflow.",
    parameters: { type: "object", additionalProperties: false, properties: { customer_confirmed: { type: "boolean" } }, required: ["customer_confirmed"] },
  },
  {
    type: "function", name: "review_checkout", description: "Read the current checkout's items, delivery address, saved payment method, and final total, then create an opaque confirmation token. Call after begin_checkout and before submit_order.",
    parameters: { type: "object", additionalProperties: false, properties: { checkout_id: { type: "string", description: "Optional checkout ID. Omit to use the current browser session's latest checkout." } }, required: [] },
  },
  {
    type: "function", name: "submit_order", description: "Submit the reviewed checkout through Bookly's simulated payment and order path. Call after review_checkout when the customer has explicitly authorized payment, including an explicit checkout-and-pay request that started the current workflow.",
    parameters: { type: "object", additionalProperties: false, properties: { checkout_id: { type: "string", description: "Optional checkout ID. Omit to use the current browser session's latest checkout." }, confirmation_token: { type: "string", description: "Opaque token returned by review_checkout. Never reveal it to the customer." }, customer_confirmed: { type: "boolean", description: "True only when the customer explicitly authorized payment for this checkout workflow." } }, required: ["confirmation_token", "customer_confirmed"] },
  },

  // --- Account: wishlist, stock alerts, sign-in ---
  {
    type: "function", name: "get_wishlist", description: "Return the signed-in customer's saved books.",
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: "function", name: "add_to_wishlist", description: "Save one authoritative catalog book to the signed-in customer's wishlist.",
    parameters: { type: "object", additionalProperties: false, properties: { book_id: { type: "string" } }, required: ["book_id"] },
  },
  {
    type: "function", name: "remove_from_wishlist", description: "Remove one book from the signed-in customer's wishlist.",
    parameters: { type: "object", additionalProperties: false, properties: { book_id: { type: "string" } }, required: ["book_id"] },
  },
  {
    type: "function", name: "create_back_in_stock_alert", description: "Create an account-email alert for one exact out-of-stock book format.",
    parameters: { type: "object", additionalProperties: false, properties: { book_id: { type: "string" }, format: { type: "string" } }, required: ["book_id", "format"] },
  },
  // --- Orders: lookup, cancel, address change (two-step where noted) ---
  {
    type: "function",
    name: "lookup_order",
    description:
      "Look up an order owned by the authenticated customer, then return status, tracking, totals, and line items.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        order_id: { type: "string", description: "Bookly order number, with or without a leading #." },
      },
      required: ["order_id"],
    },
  },
  {
    type: "function", name: "check_order_modification_eligibility", description: "Check whether an authenticated processing order can be cancelled or have its shipping address changed, and create a confirmation quote.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        order_id: { type: "string" }, action: { type: "string", enum: ["cancel", "update_shipping_address"] },
        new_address: { type: "object", additionalProperties: false, properties: { address1: { type: "string" }, address2: { type: "string" }, city: { type: "string" }, state: { type: "string" }, postal_code: { type: "string" } }, required: ["address1", "city", "state", "postal_code"] },
      }, required: ["order_id", "action"],
    },
  },
  {
    type: "function", name: "cancel_order", description: "Consume an eligibility quote to cancel a processing order after explicit confirmation.",
    parameters: { type: "object", additionalProperties: false, properties: { confirmation_token: { type: "string" }, customer_confirmed: { type: "boolean" } }, required: ["confirmation_token", "customer_confirmed"] },
  },
  {
    type: "function", name: "update_shipping_address", description: "Consume an eligibility quote to update a processing order's address after explicit confirmation.",
    parameters: { type: "object", additionalProperties: false, properties: { confirmation_token: { type: "string" }, customer_confirmed: { type: "boolean" } }, required: ["confirmation_token", "customer_confirmed"] },
  },

  // --- Refunds, replacements, returns (prepare → confirm → execute) ---
  {
    type: "function",
    name: "prepare_refund",
    description:
      "Validate refund eligibility and create a time-limited quote. For every new refund request, call search_knowledge with filter='policy' first, before this or any other refund-workflow tool. This does not issue a refund; explicit customer confirmation is still required.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        order_id: { type: "string" },
        items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              order_line_id: { type: "integer" },
              quantity: { type: "integer", minimum: 1 },
            },
            required: ["order_line_id", "quantity"],
          },
        },
        reason: { type: "string", description: "Customer-provided reason for the return or refund." },
      },
      required: ["order_id", "items", "reason"],
    },
  },
  {
    type: "function", name: "prepare_replacement", description: "Validate exact delivered order lines for a no-charge replacement and create a confirmation quote.",
    parameters: { type: "object", additionalProperties: false, properties: { order_id: { type: "string" }, items: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, properties: { order_line_id: { type: "integer" }, quantity: { type: "integer", minimum: 1 } }, required: ["order_line_id", "quantity"] } }, reason: { type: "string" } }, required: ["order_id", "items", "reason"] },
  },
  {
    type: "function", name: "create_replacement", description: "Create the quoted no-charge replacement after explicit customer confirmation.",
    parameters: { type: "object", additionalProperties: false, properties: { confirmation_token: { type: "string" }, customer_confirmed: { type: "boolean" } }, required: ["confirmation_token", "customer_confirmed"] },
  },
  {
    type: "function", name: "create_return_label", description: "Create a prepaid return label or a scannable UPS drop-off QR pass for exact eligible lines after explicit customer confirmation.",
    parameters: { type: "object", additionalProperties: false, properties: { order_id: { type: "string" }, items: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, properties: { order_line_id: { type: "integer" }, quantity: { type: "integer", minimum: 1 } }, required: ["order_line_id", "quantity"] } }, return_method: { type: "string", enum: ["printable_label", "qr_code"] }, customer_confirmed: { type: "boolean" } }, required: ["order_id", "items", "return_method", "customer_confirmed"] },
  },
  {
    type: "function", name: "get_return_status", description: "Read one return request owned by the signed-in customer.",
    parameters: { type: "object", additionalProperties: false, properties: { return_id: { type: "string" } }, required: ["return_id"] },
  },
  {
    type: "function",
    name: "process_refund",
    description:
      "Issue the previously quoted simulated payment refund. Call only after explicit customer confirmation in a later message.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        confirmation_token: { type: "string", description: "Opaque token returned by prepare_refund." },
        customer_confirmed: { type: "boolean", description: "True only after the customer explicitly confirms." },
      },
      required: ["confirmation_token", "customer_confirmed"],
    },
  },

  // --- Human support handoff ---
  {
    type: "function", name: "create_support_case", description: "Create a human-support case with a concise factual summary, priority, relevant order, and conversation excerpt.",
    parameters: { type: "object", additionalProperties: false, properties: { category: { type: "string", enum: ["shipping", "refund", "order_change", "account", "catalog", "other"] }, summary: { type: "string" }, priority: { type: "string", enum: ["normal", "high", "urgent"] }, order_id: { type: "string" }, conversation_excerpt: { type: "string" } }, required: ["category", "summary", "priority", "conversation_excerpt"] },
  },
  {
    type: "function", name: "handoff_to_agent", description: "Queue an existing authenticated support case for a human agent and return the estimated wait.",
    parameters: { type: "object", additionalProperties: false, properties: { case_id: { type: "string" } }, required: ["case_id"] },
  },

  // --- Shipping diagnostics & investigation (investigate → confirm → open) ---
  {
    type: "function",
    name: "investigate_shipment",
    description:
      "Verify an order, inspect its carrier scan timeline, diagnose delays or delivery issues, and determine whether a shipping investigation is eligible. Does not open a case.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        order_id: { type: "string", description: "Bookly order number, with or without a leading #." },
        issue_type: {
          type: "string",
          enum: ["tracking_stalled", "late_delivery", "delivered_not_received", "damaged_package", "other"],
        },
        description: { type: "string", description: "The customer's description of the shipping problem." },
        preliminary_checks_completed: {
          type: "boolean",
          description: "For delivered-not-received issues, true only after the customer confirms checking household members, neighbors, and safe delivery locations. False for other issue types.",
        },
      },
      required: ["order_id", "issue_type", "description", "preliminary_checks_completed"],
    },
  },
  {
    type: "function",
    name: "open_shipping_investigation",
    description:
      "Open a simulated carrier investigation after investigate_shipment found the issue eligible and the customer explicitly confirmed opening the case.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        confirmation_token: { type: "string", description: "Opaque token returned by investigate_shipment." },
        customer_confirmed: { type: "boolean", description: "True only after explicit confirmation in a later customer message." },
      },
      required: ["confirmation_token", "customer_confirmed"],
    },
  },

  // --- Knowledge base & UI helpers ---
  {
    type: "function",
    name: "search_knowledge",
    description:
      "Search Bookly's LanceDB knowledge base. This must be the first tool called for every new refund request, using filter='policy' to load the returns and refunds policy. Always use filter='books' for book, author, genre, catalog, or recommendation questions, and filter='policy' for shipping, returns, orders, passwords, or account policy questions. Optional book metadata filters are exact, case-insensitive constraints and only apply with filter='books'.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "A complete natural-language search query." },
        filter: {
          type: "string",
          enum: ["books", "policy"],
          description: "Required knowledge category: books for catalog questions, policy for support-policy questions.",
        },
        book_type: {
          type: "string",
          description: "Optional exact book type filter, such as fiction or nonfiction. Use only with filter='books'.",
        },
        author: {
          type: "string",
          description: "Optional exact author-name filter. Use only with filter='books'.",
        },
        genre: {
          type: "string",
          description: "Optional exact genre filter, such as literary fiction, science fiction, or gardening. Use only with filter='books'.",
        },
      },
      required: ["query", "filter"],
    },
  },
  {
    type: "function",
    name: "open_book",
    description:
      "Open one specific Bookly catalog title in the book detail window beside the chat and return its stable page_path. Use the exact title returned by search_knowledge, and only when the customer is asking about that one named book.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "The exact Bookly catalog title returned by search_knowledge." },
      },
      required: ["title"],
    },
  },
] as const;

/**
 * Builds the OpenAI Realtime session config: model, text output, agent
 * instructions, input transcription / VAD, voice, and tool wiring.
 */
export function realtimeSessionConfig({ userLoggedIn = false }: { userLoggedIn?: boolean } = {}) {
  return {
    type: "realtime",
    model: BOOKLY_MODEL,
    // Text modality keeps transcript/UI aligned; audio still used for voice I/O.
    output_modalities: ["text"],
    instructions: booklyAgentInstructions(userLoggedIn),
    audio: {
      input: {
        // Live transcription tuned for bookstore support vocabulary.
        transcription: {
          model: "gpt-live-transcribe",
          prompt: "Bookly bookstore customer support. Order numbers include 1234 and 5678.",
          keywords: ["Bookly", "order 1234", "order 5678", "refund", "tracking"],
          languages: ["en"],
          delay: "low",
        },
        // Semantic VAD: medium eagerness, auto-respond, allow barge-in.
        turn_detection: {
          type: "semantic_vad",
          eagerness: "medium",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: { voice: "marin" },
    },
    tools: BOOKLY_TOOLS,
    tool_choice: "auto",
  };
}
