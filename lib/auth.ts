import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const BOOKLY_AUTH_COOKIE = "bookly_customer_session";

const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const payloadSchema = z.object({
  version: z.literal(1),
  customerId: z.number().int().positive(),
  browserSessionId: z.string().min(8).max(128),
  expiresAt: z.number().int().positive(),
});

export type CustomerSessionPayload = z.infer<typeof payloadSchema>;

function sessionSecret() {
  const configured = process.env.BOOKLY_SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "bookly-local-development-session-secret";
  }
  throw new Error("BOOKLY_SESSION_SECRET is required in production.");
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function createCustomerSessionToken(
  customerId: number,
  browserSessionId: string,
  currentTime = Date.now(),
) {
  const payload: CustomerSessionPayload = {
    version: 1,
    customerId,
    browserSessionId,
    expiresAt: currentTime + SESSION_LIFETIME_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyCustomerSessionToken(
  token: string | undefined,
  browserSessionId: string,
  currentTime = Date.now(),
) {
  if (!token) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;

  let expected: Buffer;
  let supplied: Buffer;
  try {
    expected = Buffer.from(sign(encoded), "base64url");
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    if (!parsed.success) return null;
    if (parsed.data.browserSessionId !== browserSessionId || parsed.data.expiresAt <= currentTime) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function requestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function customerSessionFromRequest(request: Request, browserSessionId: string) {
  return verifyCustomerSessionToken(requestCookie(request, BOOKLY_AUTH_COOKIE), browserSessionId);
}
