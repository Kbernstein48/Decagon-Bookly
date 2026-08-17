import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { BooklyDatabase } from "./database";

type Customer = { id: number; email: string; firstName: string; lastName: string };
type Order = { id: string; customer_id: number; status: string; delivered_at: string | null; updated_at: string };
type Line = { id: number; title: string; quantity: number; refunded_quantity: number; refundable_until: string | null; product_type: string; is_final_sale: number };

const addressSchema = z.object({
  address1: z.string().trim().min(3).max(200),
  address2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postal_code: z.string().trim().min(3).max(20),
});
const eligibilitySchema = z.object({
  order_id: z.string().trim().min(1),
  action: z.enum(["cancel", "update_shipping_address"]),
  new_address: addressSchema.optional(),
}).superRefine((value, context) => {
  if (value.action === "update_shipping_address" && !value.new_address) context.addIssue({ code: "custom", path: ["new_address"], message: "A complete new address is required." });
});
const confirmedActionSchema = z.object({ confirmation_token: z.uuid(), customer_confirmed: z.boolean() });
const replacementSchema = z.object({
  order_id: z.string().trim().min(1),
  items: z.array(z.object({ order_line_id: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive() })).min(1),
  reason: z.string().trim().min(5).max(500),
});
const returnSchema = z.object({
  order_id: z.string().trim().min(1),
  items: z.array(z.object({ order_line_id: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive() })).min(1),
  return_method: z.enum(["printable_label", "qr_code"]),
  customer_confirmed: z.boolean(),
});
const returnStatusSchema = z.object({ return_id: z.string().trim().min(1) });
const supportCaseSchema = z.object({
  category: z.enum(["shipping", "refund", "order_change", "account", "catalog", "other"]),
  summary: z.string().trim().min(10).max(1_500),
  priority: z.enum(["normal", "high", "urgent"]),
  order_id: z.string().trim().optional(),
  conversation_excerpt: z.string().trim().min(1).max(3_000),
});
const handoffSchema = z.object({ case_id: z.string().trim().min(1) });

const timestamp = () => new Date().toISOString();
const normalizeOrderId = (value: string) => value.trim().replace(/^#/, "");

function upsCarrierReference(returnId: string) {
  const identifier = returnId.replace(/[^a-z0-9]/gi, "").slice(-13).padStart(13, "0").toUpperCase();
  return `1ZBKL${identifier}`;
}

function returnDropOffBy(createdAt: string) {
  return new Date(new Date(createdAt).getTime() + 14 * 86_400_000).toISOString();
}

function qrReturnPresentation(returnId: string, createdAt: string) {
  const carrierReference = upsCarrierReference(returnId);
  return {
    carrier: {
      name: "UPS",
      service: "UPS Returns",
      carrier_reference: carrierReference,
    },
    drop_off: {
      location_types: ["The UPS Store", "participating UPS location"],
      printer_required: false,
      packaging_required: true,
      instructions: "Pack and seal the return, then show this QR code to a UPS associate. They will scan it and print the prepaid return label.",
    },
    drop_off_by: returnDropOffBy(createdAt),
  };
}

function invalid(error: z.ZodError) {
  return { ok: false, error: { code: "INVALID_TOOL_INPUT", message: "The tool input was incomplete or invalid.", details: error.issues } };
}

function authRequired() {
  return { ok: false, error: { code: "AUTHENTICATION_REQUIRED", message: "The customer must sign in before using this account feature." } };
}

function ownedOrder(db: BooklyDatabase, orderId: string, customer: Customer) {
  return db.prepare("SELECT * FROM orders WHERE id = ? AND customer_id = ?").get(normalizeOrderId(orderId), customer.id) as Order | undefined;
}

function orderLines(db: BooklyDatabase, orderId: string) {
  return db.prepare("SELECT id, title, quantity, refunded_quantity, refundable_until, product_type, is_final_sale FROM order_lines WHERE order_id = ? ORDER BY id")
    .all(orderId) as Line[];
}

function quote(db: BooklyDatabase, actionType: string, orderId: string, customer: Customer, payload: unknown) {
  const token = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO order_action_quotes (token, action_type, order_id, customer_email, payload_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(token, actionType, orderId, customer.email.toLocaleLowerCase("en-US"), JSON.stringify(payload), expiresAt, createdAt.toISOString());
  return { confirmation_token: token, expires_at: expiresAt };
}

function readQuote(db: BooklyDatabase, token: string, actionType: string, customer: Customer) {
  const row = db.prepare("SELECT * FROM order_action_quotes WHERE token = ? AND action_type = ?").get(token, actionType) as {
    token: string; order_id: string; customer_email: string; payload_json: string; expires_at: string; used_at: string | null;
  } | undefined;
  if (!row || row.customer_email.toLocaleLowerCase("en-US") !== customer.email.toLocaleLowerCase("en-US")) return { error: { code: "ACTION_QUOTE_NOT_FOUND", message: "That action quote could not be found." } };
  if (row.used_at) return { error: { code: "ACTION_QUOTE_ALREADY_USED", message: "That action has already been completed." } };
  if (new Date(row.expires_at) < new Date()) return { error: { code: "ACTION_QUOTE_EXPIRED", message: "That action quote expired. Check eligibility again." } };
  return { row, payload: JSON.parse(row.payload_json) as unknown };
}

function checkModification(db: BooklyDatabase, rawInput: unknown, customer?: Customer) {
  if (!customer) return authRequired();
  const parsed = eligibilitySchema.safeParse(rawInput);
  if (!parsed.success) return invalid(parsed.error);
  const order = ownedOrder(db, parsed.data.order_id, customer);
  if (!order) return { ok: false, error: { code: "ORDER_VERIFICATION_FAILED", message: "That order was not found in the signed-in account." } };
  const eligible = order.status === "processing";
  if (!eligible) return { ok: true, order_id: order.id, action: parsed.data.action, eligible: false, reason: "Only processing orders can be cancelled or have their shipping address changed." };
  const actionType = parsed.data.action === "cancel" ? "cancel_order" : "update_shipping_address";
  return {
    ok: true,
    order_id: order.id,
    action: parsed.data.action,
    eligible: true,
    requires_confirmation: true,
    ...quote(db, actionType, order.id, customer, parsed.data.new_address ?? {}),
    summary: parsed.data.action === "cancel" ? `Cancel processing order ${order.id}.` : `Change the shipping address for processing order ${order.id}.`,
  };
}

function completeOrderAction(db: BooklyDatabase, rawInput: unknown, customer: Customer | undefined, actionType: "cancel_order" | "update_shipping_address") {
  if (!customer) return authRequired();
  const parsed = confirmedActionSchema.safeParse(rawInput);
  if (!parsed.success) return invalid(parsed.error);
  if (!parsed.data.customer_confirmed) return { ok: false, error: { code: "CONFIRMATION_REQUIRED", message: "The order was not changed because explicit confirmation is required." } };
  return db.transaction(() => {
    const found = readQuote(db, parsed.data.confirmation_token, actionType, customer);
    if ("error" in found) return { ok: false, error: found.error };
    const order = ownedOrder(db, found.row.order_id, customer);
    if (!order || order.status !== "processing") return { ok: false, error: { code: "ORDER_STATE_CHANGED", message: "The order is no longer eligible for this change." } };
    const changedAt = timestamp();
    if (actionType === "cancel_order") {
      db.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").run(changedAt, order.id);
    } else {
      const address = found.payload as z.infer<typeof addressSchema>;
      db.prepare(`UPDATE orders SET shipping_address1 = ?, shipping_address2 = ?, shipping_city = ?, shipping_state = ?, shipping_postal_code = ?, updated_at = ? WHERE id = ?`)
        .run(address.address1, address.address2 ?? null, address.city, address.state, address.postal_code, changedAt, order.id);
    }
    db.prepare("UPDATE order_action_quotes SET used_at = ? WHERE token = ?").run(changedAt, found.row.token);
    return actionType === "cancel_order"
      ? { ok: true, order: { order_id: order.id, status: "cancelled", cancelled_at: changedAt } }
      : { ok: true, order: { order_id: order.id, status: "processing", shipping_address: found.payload, updated_at: changedAt } };
  })();
}

function prepareReplacement(db: BooklyDatabase, rawInput: unknown, customer?: Customer) {
  if (!customer) return authRequired();
  const parsed = replacementSchema.safeParse(rawInput);
  if (!parsed.success) return invalid(parsed.error);
  const order = ownedOrder(db, parsed.data.order_id, customer);
  if (!order) return { ok: false, error: { code: "ORDER_VERIFICATION_FAILED", message: "That order was not found in the signed-in account." } };
  if (!order.delivered_at) return { ok: false, error: { code: "ORDER_NOT_DELIVERED", message: "A replacement can be prepared only for a delivered order." } };
  const lines = new Map(orderLines(db, order.id).map((line) => [line.id, line]));
  const selected = [] as Array<{ order_line_id: number; title: string; quantity: number }>;
  for (const requested of parsed.data.items) {
    const line = lines.get(requested.order_line_id);
    if (!line || requested.quantity > line.quantity - line.refunded_quantity) return { ok: false, error: { code: "REPLACEMENT_ITEM_NOT_ELIGIBLE", message: `Order line ${requested.order_line_id} is not eligible for that replacement quantity.` } };
    selected.push({ ...requested, title: line.title });
  }
  return { ok: true, requires_confirmation: true, order_id: order.id, items: selected, reason: parsed.data.reason, ...quote(db, "create_replacement", order.id, customer, { items: selected, reason: parsed.data.reason }), next_step: "Summarize the replacement and ask for explicit confirmation." };
}

function createReplacement(db: BooklyDatabase, rawInput: unknown, customer?: Customer) {
  if (!customer) return authRequired();
  const parsed = confirmedActionSchema.safeParse(rawInput);
  if (!parsed.success) return invalid(parsed.error);
  if (!parsed.data.customer_confirmed) return { ok: false, error: { code: "CONFIRMATION_REQUIRED", message: "The replacement was not created because explicit confirmation is required." } };
  return db.transaction(() => {
    const found = readQuote(db, parsed.data.confirmation_token, "create_replacement", customer);
    if ("error" in found) return { ok: false, error: found.error };
    const payload = found.payload as { items: Array<{ order_line_id: number; title: string; quantity: number }>; reason: string };
    const existing = db.prepare("SELECT id, status, estimated_ship_date FROM replacement_orders WHERE original_order_id = ? AND status IN ('processing', 'shipped')")
      .get(found.row.order_id);
    if (existing) return { ok: false, error: { code: "REPLACEMENT_ALREADY_EXISTS", message: "An active replacement already exists for this order." }, replacement: existing };
    const createdAt = new Date();
    const replacementId = `repl_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
    const estimatedShipDate = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`INSERT INTO replacement_orders (id, original_order_id, customer_id, status, reason, estimated_ship_date, created_at, updated_at) VALUES (?, ?, ?, 'processing', ?, ?, ?, ?)`)
      .run(replacementId, found.row.order_id, customer.id, payload.reason, estimatedShipDate, createdAt.toISOString(), createdAt.toISOString());
    for (const item of payload.items) db.prepare("INSERT INTO replacement_lines (replacement_id, order_line_id, quantity) VALUES (?, ?, ?)").run(replacementId, item.order_line_id, item.quantity);
    db.prepare("UPDATE order_action_quotes SET used_at = ? WHERE token = ?").run(createdAt.toISOString(), found.row.token);
    return { ok: true, replacement: { replacement_id: replacementId, original_order_id: found.row.order_id, status: "processing", items: payload.items, reason: payload.reason, estimated_ship_date: estimatedShipDate, charge: "$0.00" } };
  })();
}

function createReturnLabel(db: BooklyDatabase, rawInput: unknown, customer?: Customer) {
  if (!customer) return authRequired();
  const parsed = returnSchema.safeParse(rawInput);
  if (!parsed.success) return invalid(parsed.error);
  if (!parsed.data.customer_confirmed) return { ok: false, error: { code: "CONFIRMATION_REQUIRED", message: "The return label was not created because explicit confirmation is required." } };
  const order = ownedOrder(db, parsed.data.order_id, customer);
  if (!order) return { ok: false, error: { code: "ORDER_VERIFICATION_FAILED", message: "That order was not found in the signed-in account." } };
  if (!order.delivered_at) return { ok: false, error: { code: "ORDER_NOT_DELIVERED", message: "Returns are available after delivery." } };
  const lines = new Map(orderLines(db, order.id).map((line) => [line.id, line]));
  const selected = [] as Array<{ order_line_id: number; title: string; quantity: number }>;
  for (const requested of parsed.data.items) {
    const line = lines.get(requested.order_line_id);
    const expired = !line?.refundable_until || new Date(`${line.refundable_until}T23:59:59Z`) < new Date();
    if (!line || expired || line.product_type !== "physical" || line.is_final_sale || requested.quantity > line.quantity - line.refunded_quantity) {
      return { ok: false, error: { code: "RETURN_ITEM_NOT_ELIGIBLE", message: `Order line ${requested.order_line_id} is not eligible for that return quantity.` } };
    }
    selected.push({ ...requested, title: line.title });
  }
  const returnId = `ret_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
  const createdAt = timestamp();
  const labelUrl = `/returns/${returnId}/label`;
  const carrierReference = upsCarrierReference(returnId);
  const qrCode = `BOOKLY|UPS_RETURN|${returnId.toUpperCase()}|${carrierReference}`;
  db.transaction(() => {
    db.prepare(`INSERT INTO return_requests (id, order_id, customer_id, status, return_method, label_url, qr_code, created_at, updated_at) VALUES (?, ?, ?, 'label_created', ?, ?, ?, ?, ?)`)
      .run(returnId, order.id, customer.id, parsed.data.return_method, labelUrl, qrCode, createdAt, createdAt);
    for (const item of selected) db.prepare("INSERT INTO return_items (return_id, order_line_id, quantity) VALUES (?, ?, ?)").run(returnId, item.order_line_id, item.quantity);
  })();
  return {
    ok: true,
    return: {
      return_id: returnId,
      order_id: order.id,
      status: "label_created",
      return_method: parsed.data.return_method,
      items: selected,
      label_url: labelUrl,
      qr_code: qrCode,
      ...(parsed.data.return_method === "qr_code" ? qrReturnPresentation(returnId, createdAt) : { drop_off_by: returnDropOffBy(createdAt) }),
      prepaid: true,
    },
  };
}

function getReturnStatus(db: BooklyDatabase, rawInput: unknown, customer?: Customer) {
  if (!customer) return authRequired();
  const parsed = returnStatusSchema.safeParse(rawInput);
  if (!parsed.success) return invalid(parsed.error);
  const request = db.prepare("SELECT * FROM return_requests WHERE id = ? AND customer_id = ?").get(parsed.data.return_id, customer.id) as Record<string, unknown> | undefined;
  if (!request) return { ok: false, error: { code: "RETURN_NOT_FOUND", message: "That return was not found in the signed-in account." } };
  const items = db.prepare(`SELECT ri.order_line_id, ri.quantity, ol.title FROM return_items ri JOIN order_lines ol ON ol.id = ri.order_line_id WHERE ri.return_id = ?`).all(parsed.data.return_id);
  const qrPresentation = request.return_method === "qr_code" && typeof request.created_at === "string"
    ? qrReturnPresentation(parsed.data.return_id, request.created_at)
    : {};
  return { ok: true, return: { ...request, ...qrPresentation, items } };
}

function createSupportCase(db: BooklyDatabase, rawInput: unknown, customer?: Customer) {
  if (!customer) return authRequired();
  const parsed = supportCaseSchema.safeParse(rawInput);
  if (!parsed.success) return invalid(parsed.error);
  let orderId: string | null = null;
  if (parsed.data.order_id) {
    const order = ownedOrder(db, parsed.data.order_id, customer);
    if (!order) return { ok: false, error: { code: "ORDER_VERIFICATION_FAILED", message: "That order was not found in the signed-in account." } };
    orderId = order.id;
  }
  const caseId = `case_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
  const createdAt = timestamp();
  db.prepare(`INSERT INTO support_cases (id, customer_id, order_id, category, summary, priority, status, queue, conversation_excerpt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', 'bookly_support', ?, ?, ?)`)
    .run(caseId, customer.id, orderId, parsed.data.category, parsed.data.summary, parsed.data.priority, parsed.data.conversation_excerpt, createdAt, createdAt);
  return { ok: true, case: { case_id: caseId, order_id: orderId, category: parsed.data.category, summary: parsed.data.summary, priority: parsed.data.priority, status: "open", queue: "bookly_support", created_at: createdAt } };
}

function handoffToAgent(db: BooklyDatabase, rawInput: unknown, customer?: Customer) {
  if (!customer) return authRequired();
  const parsed = handoffSchema.safeParse(rawInput);
  if (!parsed.success) return invalid(parsed.error);
  const supportCase = db.prepare("SELECT id, status, priority, queue, summary FROM support_cases WHERE id = ? AND customer_id = ?").get(parsed.data.case_id, customer.id) as { id: string; status: string; priority: string; queue: string; summary: string } | undefined;
  if (!supportCase) return { ok: false, error: { code: "SUPPORT_CASE_NOT_FOUND", message: "That support case was not found in the signed-in account." } };
  const updatedAt = timestamp();
  db.prepare("UPDATE support_cases SET status = 'queued_for_agent', updated_at = ? WHERE id = ?").run(updatedAt, supportCase.id);
  return { ok: true, handoff: { case_id: supportCase.id, status: "queued_for_agent", queue: supportCase.queue, priority: supportCase.priority, estimated_wait: supportCase.priority === "urgent" ? "under 5 minutes" : "within 1 business hour", summary: supportCase.summary, queued_at: updatedAt } };
}

export async function executeResolutionTool(db: BooklyDatabase, name: string, input: unknown, customer?: Customer) {
  switch (name) {
    case "check_order_modification_eligibility": return checkModification(db, input, customer);
    case "cancel_order": return completeOrderAction(db, input, customer, "cancel_order");
    case "update_shipping_address": return completeOrderAction(db, input, customer, "update_shipping_address");
    case "prepare_replacement": return prepareReplacement(db, input, customer);
    case "create_replacement": return createReplacement(db, input, customer);
    case "create_return_label": return createReturnLabel(db, input, customer);
    case "get_return_status": return getReturnStatus(db, input, customer);
    case "create_support_case": return createSupportCase(db, input, customer);
    case "handoff_to_agent": return handoffToAgent(db, input, customer);
    default: return null;
  }
}
