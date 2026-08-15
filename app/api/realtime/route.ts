import { createHash } from "node:crypto";
import { realtimeSessionConfig } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });
  }
  const sdp = await request.text();
  if (!sdp.trim()) return Response.json({ error: "Missing SDP offer." }, { status: 400 });
  const sessionId = request.headers.get("x-bookly-session") || "anonymous-demo-session";
  const safetyIdentifier = createHash("sha256").update(`bookly:${sessionId}`).digest("hex");
  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(realtimeSessionConfig()));

  const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "OpenAI-Safety-Identifier": safetyIdentifier,
    },
    body: form,
  });
  const body = await upstream.text();
  if (!upstream.ok) {
    console.error("Realtime session creation failed", upstream.status, body);
    return Response.json(
      { error: "Could not start the Bookly realtime session.", upstreamStatus: upstream.status },
      { status: 502 },
    );
  }
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/sdp" },
  });
}
