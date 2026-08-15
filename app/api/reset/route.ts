import { z } from "zod";
import { getDatabase } from "@/lib/database";
import { resetDatabaseToDemoBaseline } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resetSchema = z.object({
  confirmation: z.literal("RESET_BOOKLY_DEMO"),
});

export async function POST(request: Request) {
  const parsed = resetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Explicit demo-reset confirmation is required." },
      { status: 400 },
    );
  }

  try {
    const db = await getDatabase();
    const restored = await resetDatabaseToDemoBaseline(db);
    return Response.json({ ok: true, restored });
  } catch (error) {
    console.error("Bookly demo reset failed", error);
    return Response.json(
      { ok: false, error: "The demo database could not be reset safely." },
      { status: 500 },
    );
  }
}
