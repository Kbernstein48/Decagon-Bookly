export type AuthCustomer = {
  email: string;
  firstName: string;
};

export const BOOKLY_AUTH_CHANGED_EVENT = "bookly-auth-changed";
const BOOKLY_BROWSER_SESSION_KEY = "bookly-support-session";

export function getOrCreateBooklyBrowserSession() {
  const existing = window.localStorage.getItem(BOOKLY_BROWSER_SESSION_KEY);
  if (existing) return existing;
  const sessionId = window.crypto.randomUUID();
  window.localStorage.setItem(BOOKLY_BROWSER_SESSION_KEY, sessionId);
  return sessionId;
}

export function clearBooklyBrowserSession() {
  window.localStorage.removeItem(BOOKLY_BROWSER_SESSION_KEY);
}

export function announceBooklyAuthChange(customer: AuthCustomer | null) {
  window.dispatchEvent(new CustomEvent<AuthCustomer | null>(BOOKLY_AUTH_CHANGED_EVENT, { detail: customer }));
}
