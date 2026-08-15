"use client";

import { LogOut, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  announceBooklyAuthChange,
  BOOKLY_AUTH_CHANGED_EVENT,
  getOrCreateBooklyBrowserSession,
  type AuthCustomer,
} from "@/lib/browser-auth";

export function SiteAccount() {
  const [customer, setCustomer] = useState<AuthCustomer | null>(null);

  useEffect(() => {
    const sessionId = getOrCreateBooklyBrowserSession();
    fetch("/api/auth/session", {
      headers: { "x-bookly-session": sessionId },
      cache: "no-store",
    })
      .then((response) => response.json().then((result) => ({ ok: response.ok, result })))
      .then(({ ok, result }) => setCustomer(ok && result?.authenticated ? result.customer : null))
      .catch(() => setCustomer(null));

    const handleAuthChange = (event: Event) => {
      setCustomer((event as CustomEvent<AuthCustomer | null>).detail);
    };
    window.addEventListener(BOOKLY_AUTH_CHANGED_EVENT, handleAuthChange);
    return () => window.removeEventListener(BOOKLY_AUTH_CHANGED_EVENT, handleAuthChange);
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    setCustomer(null);
    announceBooklyAuthChange(null);
  }, []);

  if (!customer) {
    return <span className="icon-button site-account-guest" aria-label="Not signed in" title="Not signed in"><UserRound size={20} /></span>;
  }

  return (
    <button className="site-account-signed-in" type="button" onClick={() => void signOut()} aria-label={`Signed in as ${customer.email}. Sign out`} title={`Signed in as ${customer.email}`}>
      <span>{customer.firstName.slice(0, 1).toUpperCase()}</span>
      <strong>{customer.firstName}</strong>
      <LogOut size={14} />
    </button>
  );
}
