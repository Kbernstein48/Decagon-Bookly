import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createCustomerSessionToken, verifyCustomerSessionToken } from "../lib/auth";

process.env.BOOKLY_SESSION_SECRET = "bookly-auth-test-secret-at-least-32-characters";

describe("Bookly customer sessions", () => {
  test("binds a signed session to one browser session and expires it", () => {
    const issuedAt = 1_800_000_000_000;
    const token = createCustomerSessionToken(42, "browser-session-123", issuedAt);

    assert.equal(
      verifyCustomerSessionToken(token, "browser-session-123", issuedAt + 1_000)?.customerId,
      42,
    );
    assert.equal(verifyCustomerSessionToken(token, "another-browser-session", issuedAt + 1_000), null);
    assert.equal(verifyCustomerSessionToken(token, "browser-session-123", issuedAt + 13 * 60 * 60 * 1000), null);
  });

  test("rejects a tampered session token", () => {
    const token = createCustomerSessionToken(42, "browser-session-123", 1_800_000_000_000);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    assert.equal(verifyCustomerSessionToken(tampered, "browser-session-123", 1_800_000_001_000), null);
  });
});
