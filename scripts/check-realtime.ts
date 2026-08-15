import { BOOKLY_MODEL, realtimeSessionConfig } from "../lib/agent";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not configured.");
}

const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ session: realtimeSessionConfig() }),
});
const data = await response.json() as {
  value?: string;
  client_secret?: { value?: string; expires_at?: number };
  expires_at?: number;
  error?: { message?: string; code?: string };
};

if (!response.ok) {
  console.error({ status: response.status, code: data.error?.code, message: data.error?.message });
  process.exitCode = 1;
} else {
  console.log({
    ok: true,
    model: BOOKLY_MODEL,
    credentialIssued: Boolean(data.value || data.client_secret?.value),
    expiresAt: data.expires_at || data.client_secret?.expires_at || null,
  });
}
