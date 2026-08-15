import { z } from "zod";
import { customerSessionFromRequest } from "@/lib/auth";
import { getDatabase } from "@/lib/database";
import { saveToolRun } from "@/lib/history";
import { executeTool, type AuthenticatedCustomer } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  sessionId: z.string().min(8).max(128),
  callId: z.string().min(1).max(200),
  name: z.string().min(1).max(100),
  arguments: z.unknown(),
});

export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: { code: "INVALID_REQUEST", message: "Malformed tool request." } }, { status: 400 });
  }
  const db = await getDatabase();
  const customerSession = customerSessionFromRequest(request, parsed.data.sessionId);
  const authenticatedCustomer = customerSession
    ? db.prepare(`
        SELECT id, email, first_name AS firstName, last_name AS lastName
        FROM customers
        WHERE id = ?
      `).get(customerSession.customerId) as AuthenticatedCustomer | undefined
    : undefined;
  const startedAt = performance.now();
  let output: unknown;
  try {
    output = await executeTool(db, parsed.data.name, parsed.data.arguments, {
      sessionId: parsed.data.sessionId,
      authenticatedCustomer,
    });
  } catch (error) {
    console.error("Bookly tool failed", error);
    output = { ok: false, error: { code: "TOOL_EXECUTION_FAILED", message: "The tool could not complete safely." } };
  }
  const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
  const succeeded = Boolean(output && typeof output === "object" && "ok" in output && (output as { ok: boolean }).ok);
  const record = saveToolRun(db, {
    sessionId: parsed.data.sessionId,
    callId: parsed.data.callId,
    toolName: parsed.data.name,
    toolInput: parsed.data.arguments,
    toolOutput: output,
    status: succeeded ? "completed" : "failed",
    durationMs,
  });
  return Response.json({ output, trace: { ...record, durationMs, status: succeeded ? "completed" : "failed" } });
}
