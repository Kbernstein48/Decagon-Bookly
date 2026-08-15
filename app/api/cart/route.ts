import { z } from "zod";
import { customerSessionFromRequest } from "@/lib/auth";
import { getDatabase } from "@/lib/database";
import { executeTool, type AuthenticatedCustomer } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionSchema = z.string().min(8).max(128);
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), cart_item_id: z.string().min(1), quantity: z.number().int().min(1).max(20) }),
  z.object({ action: z.literal("remove"), cart_item_id: z.string().min(1) }),
  z.object({ action: z.literal("checkout") }),
]);

async function context(request: Request) {
  const sessionId = request.headers.get("x-bookly-session");
  const parsed = sessionSchema.safeParse(sessionId);
  if (!parsed.success) return null;
  const db = await getDatabase();
  const session = customerSessionFromRequest(request, parsed.data);
  const authenticatedCustomer = session
    ? db.prepare(`SELECT id, email, first_name AS firstName, last_name AS lastName FROM customers WHERE id = ?`).get(session.customerId) as AuthenticatedCustomer | undefined
    : undefined;
  return { db, sessionId: parsed.data, authenticatedCustomer };
}

export async function GET(request: Request) {
  const resolved = await context(request);
  if (!resolved) return Response.json({ ok: false, error: "Invalid browser session." }, { status: 400 });
  return Response.json(await executeTool(resolved.db, "get_cart", {}, resolved));
}

export async function PATCH(request: Request) {
  const resolved = await context(request);
  if (!resolved) return Response.json({ ok: false, error: "Invalid browser session." }, { status: 400 });
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid cart change." }, { status: 400 });
  const toolName = parsed.data.action === "update" ? "update_cart_item" : parsed.data.action === "remove" ? "remove_from_cart" : "begin_checkout";
  const input = parsed.data.action === "checkout" ? { customer_confirmed: true } : parsed.data;
  return Response.json(await executeTool(resolved.db, toolName, input, resolved));
}
