import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { BooklyDatabase } from "./database";
import { embedTexts } from "./embeddings";
import { searchKnowledgeBase } from "./vector-store";
import { executeCommerceTool } from "./commerce-tools";
import { executeResolutionTool } from "./resolution-tools";
import books from "../knowledge/books.json";

const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

const normalizeOrderId = (value: string) => value.trim().replace(/^#/, "");

const lookupOrderSchema = z.object({
  order_id: z.string().trim().min(1).optional(),
});

const prepareRefundSchema = z.object({
  order_id: z.string().trim().min(1),
  items: z.array(z.object({
    order_line_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive(),
  })).min(1),
  reason: z.string().trim().min(3).max(500),
});

const processRefundSchema = z.object({
  confirmation_token: z.uuid(),
  customer_confirmed: z.boolean(),
});

const searchKnowledgeSchema = z.object({
  query: z.string().trim().min(3).max(500),
  filter: z.enum(["books", "policy"]),
  book_type: z.string().trim().min(1).max(100).optional(),
  author: z.string().trim().min(1).max(200).optional(),
  genre: z.string().trim().min(1).max(100).optional(),
}).superRefine((input, context) => {
  if (input.filter === "policy" && (input.book_type || input.author || input.genre)) {
    context.addIssue({
      code: "custom",
      path: ["filter"],
      message: "Book metadata filters can only be used when filter is books.",
    });
  }
});

const bookTitleSchema = z.string().trim().min(1).max(300);

const openBookSchema = z.object({
  // `title` remains supported for older clients while the realtime agent uses
  // `titles` for both single- and multi-book detail requests.
  title: bookTitleSchema.optional(),
  titles: z.array(bookTitleSchema).min(1).max(8).optional(),
}).superRefine((input, context) => {
  if (!input.title && !input.titles) {
    context.addIssue({
      code: "custom",
      path: ["titles"],
      message: "Provide at least one exact catalog title.",
    });
  }
});

const investigateShipmentSchema = z.object({
  order_id: z.string().trim().min(1),
  issue_type: z.enum(["tracking_stalled", "late_delivery", "delivered_not_received", "damaged_package", "other"]),
  description: z.string().trim().min(5).max(1_000),
  preliminary_checks_completed: z.boolean(),
});

const openShippingInvestigationSchema = z.object({
  confirmation_token: z.uuid(),
  customer_confirmed: z.boolean(),
});

type ToolName =
  | "authenticate_customer"
  | "lookup_order"
  | "investigate_shipment"
  | "open_shipping_investigation"
  | "prepare_refund"
  | "process_refund"
  | "search_knowledge"
  | "open_book"
  | "search_catalog"
  | "get_book"
  | "get_cart"
  | "add_to_cart"
  | "update_cart_item"
  | "remove_from_cart"
  | "clear_cart"
  | "begin_checkout"
  | "review_checkout"
  | "submit_order"
  | "get_wishlist"
  | "add_to_wishlist"
  | "remove_from_wishlist"
  | "create_back_in_stock_alert"
  | "check_order_modification_eligibility"
  | "cancel_order"
  | "update_shipping_address"
  | "prepare_replacement"
  | "create_replacement"
  | "create_return_label"
  | "get_return_status"
  | "create_support_case"
  | "handoff_to_agent";

export type AuthenticatedCustomer = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
};

export type ToolContext = {
  sessionId?: string;
  authenticatedCustomer?: AuthenticatedCustomer;
};

type OrderRow = {
  id: string;
  status: string;
  placed_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery: string | null;
  carrier: string | null;
  tracking_number: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  shipping_city: string;
  shipping_state: string;
};

type LineRow = {
  id: number;
  order_id: string;
  sku: string;
  title: string;
  author: string;
  product_type: string;
  quantity: number;
  refunded_quantity: number;
  unit_price_cents: number;
  fulfillment_status: string;
  refundable_until: string | null;
  is_final_sale: number;
};

type ShipmentEventRow = {
  occurred_at: string;
  status_code: string;
  description: string;
  location: string | null;
};

function verifiedOrder(db: BooklyDatabase, orderId: string, customerId: number) {
  return db.prepare(`
    SELECT o.*
    FROM orders o
    WHERE o.id = ? AND o.customer_id = ?
  `).get(normalizeOrderId(orderId), customerId) as OrderRow | undefined;
}

function authenticationRequired() {
  return {
    ok: false,
    error: {
      code: "AUTHENTICATION_REQUIRED",
      message: "The customer must sign in through the secure account prompt before using this tool.",
    },
  };
}

function validationError(error: z.ZodError) {
  return {
    ok: false,
    error: {
      code: "INVALID_TOOL_INPUT",
      message: "The tool input was incomplete or invalid.",
      details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    },
  };
}

function orderSnapshot(db: BooklyDatabase, order: OrderRow) {
  const lines = db.prepare(`
    SELECT * FROM order_lines WHERE order_id = ? ORDER BY id
  `).all(order.id) as LineRow[];
  return {
    order_id: order.id,
    status: order.status,
    placed_at: order.placed_at,
    shipped_at: order.shipped_at,
    delivered_at: order.delivered_at,
    estimated_delivery: order.estimated_delivery,
    shipment: order.tracking_number
      ? { carrier: order.carrier, tracking_number: order.tracking_number }
      : null,
    shipping_to: `${order.shipping_city}, ${order.shipping_state}`,
    totals: {
      subtotal: money(order.subtotal_cents, order.currency),
      shipping: money(order.shipping_cents, order.currency),
      tax: money(order.tax_cents, order.currency),
      total: money(order.total_cents, order.currency),
    },
    lines: lines.map((line) => ({
      order_line_id: line.id,
      sku: line.sku,
      title: line.title,
      author: line.author,
      quantity: line.quantity,
      refundable_quantity: Math.max(0, line.quantity - line.refunded_quantity),
      unit_price: money(line.unit_price_cents, order.currency),
      fulfillment_status: line.fulfillment_status,
      refundable_until: line.refundable_until,
    })),
  };
}

function lookupOrder(db: BooklyDatabase, rawInput: unknown, customer?: AuthenticatedCustomer) {
  if (!customer) return authenticationRequired();
  const parsed = lookupOrderSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.order_id) {
    const orders = db.prepare(`
      SELECT *
      FROM orders
      WHERE customer_id = ?
      ORDER BY placed_at DESC, id DESC
      LIMIT 10
    `).all(customer.id) as OrderRow[];
    return {
      ok: true,
      account: {
        first_name: customer.firstName,
        order_count: orders.length,
        orders: orders.map((order) => orderSnapshot(db, order)),
      },
    };
  }
  const order = verifiedOrder(db, parsed.data.order_id, customer.id);
  if (!order) {
    return {
      ok: false,
      error: {
        code: "ORDER_VERIFICATION_FAILED",
        message: "That order number was not found in the signed-in account.",
      },
    };
  }
  return { ok: true, order: orderSnapshot(db, order) };
}

function daysSince(isoDate: string | null) {
  if (!isoDate) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000));
}

function shipmentDiagnostic(db: BooklyDatabase, order: OrderRow) {
  const events = db.prepare(`
    SELECT occurred_at, status_code, description, location
    FROM shipment_events
    WHERE order_id = ?
    ORDER BY occurred_at DESC
  `).all(order.id) as ShipmentEventRow[];
  const latest = events[0];
  const daysSinceLastScan = daysSince(latest?.occurred_at ?? order.shipped_at);
  const estimatedDeliveryPassed = Boolean(
    order.estimated_delivery &&
    new Date(`${order.estimated_delivery}T23:59:59Z`).getTime() < Date.now() &&
    !order.delivered_at,
  );

  return {
    carrier: order.carrier,
    tracking_number: order.tracking_number,
    latest_scan: latest ?? null,
    days_since_last_scan: daysSinceLastScan,
    estimated_delivery: order.estimated_delivery,
    estimated_delivery_passed: estimatedDeliveryPassed,
    tracking_stalled: !order.delivered_at && daysSinceLastScan !== null && daysSinceLastScan >= 5,
    events,
  };
}

function investigationEligibility(
  order: OrderRow,
  diagnostic: ReturnType<typeof shipmentDiagnostic>,
  issueType: z.infer<typeof investigateShipmentSchema>["issue_type"],
  preliminaryChecksCompleted = true,
) {
  if (!order.shipped_at || !order.tracking_number) {
    return { eligible: false, reason: "This order has not shipped yet, so there is no carrier shipment to investigate." };
  }
  if (issueType === "tracking_stalled" && !diagnostic.tracking_stalled) {
    return { eligible: false, reason: "Tracking has changed within the last 5 calendar days, so the stalled-tracking threshold has not been reached." };
  }
  if (issueType === "late_delivery" && !diagnostic.estimated_delivery_passed) {
    return { eligible: false, reason: "The estimated delivery date has not passed." };
  }
  if (issueType === "delivered_not_received" && !order.delivered_at) {
    return { eligible: false, reason: "The carrier has not marked this shipment delivered." };
  }
  if (issueType === "delivered_not_received" && !preliminaryChecksCompleted) {
    return { eligible: false, reason: "Before opening a case, check household members, neighbors, and safe delivery locations." };
  }
  if (issueType === "damaged_package" && !order.delivered_at) {
    return { eligible: false, reason: "Damage investigations are available only after delivery." };
  }
  if (issueType === "damaged_package" && daysSince(order.delivered_at)! > 14) {
    return { eligible: false, reason: "Damaged packages must be reported within 14 days of delivery." };
  }
  if (issueType === "other") {
    return { eligible: false, reason: "This shipping issue needs review by a human support specialist before a carrier case can be opened." };
  }
  return { eligible: true, reason: "This shipment is eligible for a Bookly carrier investigation." };
}

function investigateShipment(db: BooklyDatabase, rawInput: unknown, customer?: AuthenticatedCustomer) {
  if (!customer) return authenticationRequired();
  const parsed = investigateShipmentSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const order = verifiedOrder(db, parsed.data.order_id, customer.id);
  if (!order) {
    return {
      ok: false,
      error: {
        code: "ORDER_VERIFICATION_FAILED",
        message: "That order number was not found in the signed-in account.",
      },
    };
  }

  const diagnostic = shipmentDiagnostic(db, order);
  const eligibility = investigationEligibility(
    order,
    diagnostic,
    parsed.data.issue_type,
    parsed.data.preliminary_checks_completed,
  );
  const existingCase = db.prepare(`
    SELECT id, issue_type, status, carrier_case_reference, expected_response_by, created_at
    FROM shipping_investigations
    WHERE order_id = ? AND status IN ('open', 'carrier_review')
    ORDER BY created_at DESC LIMIT 1
  `).get(order.id);

  let confirmationToken: string | null = null;
  let expiresAt: string | null = null;
  if (eligibility.eligible && !existingCase) {
    confirmationToken = randomUUID();
    const createdAt = new Date();
    expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO shipping_investigation_quotes (
        token, order_id, customer_email, issue_type, description,
        expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      confirmationToken,
      order.id,
      customer.email.toLowerCase(),
      parsed.data.issue_type,
      parsed.data.description,
      expiresAt,
      createdAt.toISOString(),
    );
  }

  return {
    ok: true,
    order_id: order.id,
    order_status: order.status,
    issue: { type: parsed.data.issue_type, description: parsed.data.description },
    diagnostic,
    investigation: {
      ...eligibility,
      requires_confirmation: eligibility.eligible && !existingCase,
      confirmation_token: confirmationToken,
      expires_at: expiresAt,
      existing_case: existingCase ?? null,
      next_step: existingCase
        ? "Explain that an investigation is already open."
        : eligibility.eligible
          ? "Summarize the carrier scans and ask the customer to explicitly confirm opening a simulated carrier case."
          : "Explain why the shipment is not yet eligible and give the most relevant next step.",
    },
  };
}

function addBusinessDays(start: Date, days: number) {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    const weekday = result.getUTCDay();
    if (weekday !== 0 && weekday !== 6) added += 1;
  }
  return result;
}

function openShippingInvestigation(db: BooklyDatabase, rawInput: unknown, customer?: AuthenticatedCustomer) {
  if (!customer) return authenticationRequired();
  const parsed = openShippingInvestigationSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.customer_confirmed) {
    return {
      ok: false,
      error: { code: "CONFIRMATION_REQUIRED", message: "The carrier investigation was not opened because explicit customer confirmation is required." },
    };
  }

  return db.transaction(() => {
    const quote = db.prepare(`
      SELECT token, order_id, customer_email, issue_type, description, expires_at, used_at
      FROM shipping_investigation_quotes WHERE token = ?
    `).get(parsed.data.confirmation_token) as {
      token: string;
      order_id: string;
      customer_email: string;
      issue_type: z.infer<typeof investigateShipmentSchema>["issue_type"];
      description: string;
      expires_at: string;
      used_at: string | null;
    } | undefined;
    if (!quote) return { ok: false, error: { code: "INVESTIGATION_QUOTE_NOT_FOUND", message: "The shipping investigation quote could not be found." } };
    if (quote.customer_email.toLowerCase() !== customer.email.toLowerCase()) {
      return { ok: false, error: { code: "INVESTIGATION_QUOTE_NOT_FOUND", message: "The shipping investigation quote could not be found." } };
    }
    if (quote.used_at) return { ok: false, error: { code: "INVESTIGATION_QUOTE_ALREADY_USED", message: "This shipping investigation quote has already been used." } };
    if (new Date(quote.expires_at) < new Date()) return { ok: false, error: { code: "INVESTIGATION_QUOTE_EXPIRED", message: "The shipping investigation quote expired. Run a new shipment diagnostic." } };

    const order = verifiedOrder(db, quote.order_id, customer.id);
    if (!order) return { ok: false, error: { code: "ORDER_VERIFICATION_FAILED", message: "The verified order is no longer available." } };
    const diagnostic = shipmentDiagnostic(db, order);
    const eligibility = investigationEligibility(order, diagnostic, quote.issue_type);
    if (!eligibility.eligible) return { ok: false, error: { code: "INVESTIGATION_NOT_ELIGIBLE", message: eligibility.reason }, diagnostic };

    const existing = db.prepare(`
      SELECT id, issue_type, status, carrier_case_reference, expected_response_by, created_at
      FROM shipping_investigations
      WHERE order_id = ? AND status IN ('open', 'carrier_review')
      ORDER BY created_at DESC LIMIT 1
    `).get(order.id);
    if (existing) {
      return { ok: false, error: { code: "INVESTIGATION_ALREADY_OPEN", message: "An active shipping investigation already exists for this order." }, investigation: existing };
    }

    const createdAt = new Date();
    const caseId = `ship_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
    const carrierReference = `sim_${order.carrier?.toLowerCase() ?? "carrier"}_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
    const expectedResponseBy = addBusinessDays(createdAt, 2).toISOString();
    db.prepare(`
      INSERT INTO shipping_investigations (
        id, order_id, issue_type, description, status, carrier_case_reference,
        expected_response_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)
    `).run(
      caseId,
      order.id,
      quote.issue_type,
      quote.description,
      carrierReference,
      expectedResponseBy,
      createdAt.toISOString(),
      createdAt.toISOString(),
    );
    db.prepare("UPDATE shipping_investigation_quotes SET used_at = ? WHERE token = ?")
      .run(createdAt.toISOString(), quote.token);

    return {
      ok: true,
      investigation: {
        case_id: caseId,
        order_id: order.id,
        issue_type: quote.issue_type,
        status: "open",
        simulated_carrier_case: true,
        carrier: order.carrier,
        carrier_case_reference: carrierReference,
        expected_response_by: expectedResponseBy,
        latest_scan: diagnostic.latest_scan,
        created_at: createdAt.toISOString(),
      },
    };
  })();
}

function prepareRefund(db: BooklyDatabase, rawInput: unknown, customer?: AuthenticatedCustomer) {
  if (!customer) return authenticationRequired();
  const parsed = prepareRefundSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const order = verifiedOrder(db, parsed.data.order_id, customer.id);
  if (!order) {
    return {
      ok: false,
      error: {
        code: "ORDER_VERIFICATION_FAILED",
        message: "That order number was not found in the signed-in account.",
      },
    };
  }
  if (!order.delivered_at) {
    return {
      ok: false,
      error: {
        code: "ORDER_NOT_DELIVERED",
        message: "This order has not been delivered, so its items are not yet eligible for the return-and-refund flow.",
      },
    };
  }

  const requested = new Map<number, number>();
  for (const item of parsed.data.items) {
    requested.set(item.order_line_id, (requested.get(item.order_line_id) ?? 0) + item.quantity);
  }
  const lines = db.prepare("SELECT * FROM order_lines WHERE order_id = ? ORDER BY id").all(order.id) as LineRow[];
  const lineById = new Map(lines.map((line) => [line.id, line]));
  const quoteItems: Array<{
    order_line_id: number;
    title: string;
    quantity: number;
    item_subtotal_cents: number;
  }> = [];

  for (const [lineId, quantity] of requested) {
    const line = lineById.get(lineId);
    if (!line) {
      return { ok: false, error: { code: "LINE_NOT_FOUND", message: `Order line ${lineId} is not part of this order.` } };
    }
    const available = line.quantity - line.refunded_quantity;
    if (quantity > available) {
      return {
        ok: false,
        error: {
          code: "QUANTITY_NOT_REFUNDABLE",
          message: `${line.title} has only ${available} refundable unit(s) remaining.`,
        },
      };
    }
    if (line.product_type !== "physical" || line.is_final_sale) {
      return { ok: false, error: { code: "ITEM_NOT_RETURNABLE", message: `${line.title} is not returnable under Bookly's policy.` } };
    }
    if (!line.refundable_until || new Date(`${line.refundable_until}T23:59:59Z`) < new Date()) {
      return { ok: false, error: { code: "RETURN_WINDOW_CLOSED", message: `The return window for ${line.title} has closed.` } };
    }
    quoteItems.push({
      order_line_id: line.id,
      title: line.title,
      quantity,
      item_subtotal_cents: line.unit_price_cents * quantity,
    });
  }

  const selectedSubtotal = quoteItems.reduce((total, item) => total + item.item_subtotal_cents, 0);
  const allocatedTax = Math.round((order.tax_cents * selectedSubtotal) / order.subtotal_cents);
  const amountCents = selectedSubtotal + allocatedTax;
  const token = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000);
  db.prepare(`
    INSERT INTO refund_quotes (
      token, order_id, customer_email, items_json, reason, amount_cents,
      expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    token,
    order.id,
    customer.email.toLowerCase(),
    JSON.stringify(quoteItems),
    parsed.data.reason,
    amountCents,
    expiresAt.toISOString(),
    createdAt.toISOString(),
  );

  return {
    ok: true,
    requires_confirmation: true,
    confirmation_token: token,
    expires_at: expiresAt.toISOString(),
    quote: {
      order_id: order.id,
      items: quoteItems.map((item) => ({
        order_line_id: item.order_line_id,
        title: item.title,
        quantity: item.quantity,
        item_subtotal: money(item.item_subtotal_cents, order.currency),
      })),
      item_subtotal: money(selectedSubtotal, order.currency),
      allocated_tax: money(allocatedTax, order.currency),
      original_shipping_refund: money(0, order.currency),
      refund_total: money(amountCents, order.currency),
      reason: parsed.data.reason,
    },
    next_step: "Summarize the quote and ask the customer to explicitly confirm before calling process_refund.",
  };
}

function processRefund(db: BooklyDatabase, rawInput: unknown, customer?: AuthenticatedCustomer) {
  if (!customer) return authenticationRequired();
  const parsed = processRefundSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.customer_confirmed) {
    return {
      ok: false,
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "The refund was not processed because explicit customer confirmation is required.",
      },
    };
  }

  return db.transaction(() => {
    const quote = db.prepare("SELECT * FROM refund_quotes WHERE token = ?").get(parsed.data.confirmation_token) as {
      token: string;
      order_id: string;
      customer_email: string;
      items_json: string;
      reason: string;
      amount_cents: number;
      expires_at: string;
      used_at: string | null;
    } | undefined;
    if (!quote) return { ok: false, error: { code: "QUOTE_NOT_FOUND", message: "The refund quote could not be found." } };
    if (quote.customer_email.toLowerCase() !== customer.email.toLowerCase()) {
      return { ok: false, error: { code: "QUOTE_NOT_FOUND", message: "The refund quote could not be found." } };
    }
    if (quote.used_at) return { ok: false, error: { code: "QUOTE_ALREADY_USED", message: "This refund quote has already been processed." } };
    if (new Date(quote.expires_at) < new Date()) return { ok: false, error: { code: "QUOTE_EXPIRED", message: "The refund quote expired. Prepare a new quote before continuing." } };

    const items = JSON.parse(quote.items_json) as Array<{
      order_line_id: number;
      title: string;
      quantity: number;
      item_subtotal_cents: number;
    }>;
    for (const item of items) {
      const line = db.prepare("SELECT quantity, refunded_quantity FROM order_lines WHERE id = ? AND order_id = ?").get(item.order_line_id, quote.order_id) as { quantity: number; refunded_quantity: number } | undefined;
      if (!line || line.quantity - line.refunded_quantity < item.quantity) {
        return { ok: false, error: { code: "REFUND_STATE_CHANGED", message: "Refund eligibility changed after the quote. Prepare a new quote." } };
      }
    }

    const refundId = `rf_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
    const paymentReference = `sim_pay_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO refunds (id, order_id, status, reason, amount_cents, payment_reference, created_at)
      VALUES (?, ?, 'succeeded', ?, ?, ?, ?)
    `).run(refundId, quote.order_id, quote.reason, quote.amount_cents, paymentReference, createdAt);

    const selectedSubtotal = items.reduce((total, item) => total + item.item_subtotal_cents, 0);
    for (const item of items) {
      const allocatedAmount = Math.round((quote.amount_cents * item.item_subtotal_cents) / selectedSubtotal);
      db.prepare(`
        INSERT INTO refund_lines (refund_id, order_line_id, quantity, amount_cents)
        VALUES (?, ?, ?, ?)
      `).run(refundId, item.order_line_id, item.quantity, allocatedAmount);
      db.prepare(`
        UPDATE order_lines
        SET refunded_quantity = refunded_quantity + ?
        WHERE id = ?
      `).run(item.quantity, item.order_line_id);
    }

    const quantities = db.prepare(`
      SELECT SUM(quantity) AS purchased, SUM(refunded_quantity) AS refunded
      FROM order_lines WHERE order_id = ?
    `).get(quote.order_id) as { purchased: number; refunded: number };
    const orderStatus = quantities.purchased === quantities.refunded ? "refunded" : "partially_refunded";
    db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(orderStatus, createdAt, quote.order_id);
    db.prepare("UPDATE refund_quotes SET used_at = ? WHERE token = ?").run(createdAt, quote.token);

    return {
      ok: true,
      refund: {
        refund_id: refundId,
        order_id: quote.order_id,
        status: "succeeded",
        simulated_payment_processor: true,
        payment_reference: paymentReference,
        amount: money(quote.amount_cents),
        reason: quote.reason,
        items: items.map((item) => ({ title: item.title, quantity: item.quantity })),
        expected_bank_timing: "5-10 business days",
        created_at: createdAt,
      },
    };
  })();
}

async function searchKnowledge(db: BooklyDatabase, rawInput: unknown) {
  const parsed = searchKnowledgeSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'embedding_provider'").get() as { value: string } | undefined;
  const embedded = await embedTexts([parsed.data.query], setting?.value);
  if (setting && embedded.provider !== setting.value) {
    return {
      ok: false,
      error: {
        code: "EMBEDDING_PROVIDER_UNAVAILABLE",
        message: "Knowledge search is temporarily unavailable because its embedding provider could not be reached.",
      },
    };
  }
  const matches = await searchKnowledgeBase(db, embedded.vectors[0], {
    filter: parsed.data.filter,
    bookType: parsed.data.book_type,
    author: parsed.data.author,
    genre: parsed.data.genre,
  });
  const appliedFilters = {
    filter: parsed.data.filter,
    ...(parsed.data.book_type ? { book_type: parsed.data.book_type } : {}),
    ...(parsed.data.author ? { author: parsed.data.author } : {}),
    ...(parsed.data.genre ? { genre: parsed.data.genre } : {}),
  };
  return {
    ok: true,
    query: parsed.data.query,
    retrieval: {
      engine: "LanceDB",
      embedding_provider: embedded.provider,
      applied_filters: appliedFilters,
      result_count: matches.length,
    },
    matches: matches.map((match) => ({
      document_type: match.document_type,
      title: match.title,
      section: match.section,
      content: match.content,
      description: match.description || undefined,
      source: match.source,
      ...(match.document_type === "books" ? {
        page_path: `/books/${match.slug}`,
        metadata: {
          author: match.author,
          book_type: match.book_type,
          genre: match.genre,
          publication_year: match.publication_year,
          pages: match.pages,
          isbn: match.isbn,
          formats: match.formats.split(", "),
          price: match.price,
          audience: match.audience,
          themes: match.themes.split(", "),
        },
      } : {}),
      distance: Number(match._distance.toFixed(4)),
    })),
  };
}

function openBook(rawInput: unknown) {
  const parsed = openBookSchema.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error);
  const requestedTitles = [
    ...(parsed.data.titles ?? []),
    ...(parsed.data.title ? [parsed.data.title] : []),
  ];
  const uniqueTitles = [...new Map(
    requestedTitles.map((title) => [title.toLocaleLowerCase(), title] as const),
  ).values()];
  const catalogByTitle = new Map(books.map((book) => [book.title.toLocaleLowerCase(), book] as const));
  const matchedBooks = uniqueTitles.flatMap((title) => {
    const book = catalogByTitle.get(title.toLocaleLowerCase());
    return book ? [{ ...book, page_path: `/books/${book.slug}` }] : [];
  });
  const notFoundTitles = uniqueTitles.filter((title) => !catalogByTitle.has(title.toLocaleLowerCase()));

  if (matchedBooks.length === 0) {
    return {
      ok: false,
      error: {
        code: "BOOK_NOT_FOUND",
        message: uniqueTitles.length === 1
          ? "That exact title is not in the Bookly catalog. Search the catalog before opening a book."
          : "None of those exact titles are in the Bookly catalog. Search the catalog before opening books.",
      },
    };
  }

  if (parsed.data.title && !parsed.data.titles) {
    return { ok: true, book: matchedBooks[0] };
  }

  return {
    ok: true,
    books: matchedBooks,
    opened_count: matchedBooks.length,
    ...(notFoundTitles.length > 0 ? { not_found_titles: notFoundTitles } : {}),
  };
}

export async function executeTool(db: BooklyDatabase, name: string, input: unknown, context: ToolContext = {}): Promise<unknown> {
  const customer = context.authenticatedCustomer;
  const commerceOutput = await executeCommerceTool(db, name, input, context);
  if (commerceOutput !== null) return commerceOutput;
  const resolutionOutput = await executeResolutionTool(db, name, input, customer);
  if (resolutionOutput !== null) return resolutionOutput;
  switch (name as ToolName) {
    case "authenticate_customer": return customer
      ? { ok: true, authenticated: true, customer: { first_name: customer.firstName } }
      : authenticationRequired();
    case "lookup_order": return lookupOrder(db, input, customer);
    case "investigate_shipment": return investigateShipment(db, input, customer);
    case "open_shipping_investigation": return openShippingInvestigation(db, input, customer);
    case "prepare_refund": return prepareRefund(db, input, customer);
    case "process_refund": return processRefund(db, input, customer);
    case "search_knowledge": return searchKnowledge(db, input);
    case "open_book": return openBook(input);
    default:
      return { ok: false, error: { code: "UNKNOWN_TOOL", message: `Unknown tool: ${name}` } };
  }
}
