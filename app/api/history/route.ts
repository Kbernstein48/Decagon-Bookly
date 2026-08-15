import { z } from "zod";
import { getDatabase } from "@/lib/database";
import { getHistory, saveMessage } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionSchema = z.string().min(8).max(128);
const messageSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  sessionId: sessionSchema,
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(20_000),
  modality: z.enum(["text", "voice"]),
});

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const parsed = sessionSchema.safeParse(sessionId);
  if (!parsed.success) return Response.json({ error: "Invalid session." }, { status: 400 });
  const db = await getDatabase();
  return Response.json(getHistory(db, parsed.data));
}

export async function POST(request: Request) {
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid message." }, { status: 400 });
  const db = await getDatabase();
  return Response.json(saveMessage(db, parsed.data));
}
