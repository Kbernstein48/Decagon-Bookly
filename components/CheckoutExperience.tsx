"use client";

import { CheckCircle2, CreditCard, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getOrCreateBooklyBrowserSession } from "@/lib/browser-auth";
import { announceBooklyCartChange } from "@/lib/browser-cart";
import {
  BOOKLY_CHECKOUT_CHANGED_EVENT,
  type BooklyCheckoutChange,
} from "@/lib/browser-checkout";

type Receipt = {
  order_id: string;
  status: string;
  placed_at: string;
  estimated_delivery: string | null;
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
  payment: null | {
    status: string;
    reference: string;
    method: string;
    paid_at: string;
    simulated: boolean;
  };
};

type ReadyCheckout = {
  status: "ready";
  checkout_id: string;
  customer: { first_name: string; last_name: string; email: string };
  items: Array<{
    cart_item_id: string;
    title: string;
    author: string;
    format: string;
    quantity: number;
    unit_price: string;
    line_total: string;
  }>;
  totals: { subtotal: string; shipping: string; tax: string; total: string };
  payment_method: {
    id: string;
    brand: string;
    last4: string;
    display_number: string;
    expiry: string;
    cardholder_name: string;
  };
  shipping_address: {
    name: string;
    address1: string;
    address2: string | null;
    city: string;
    state: string;
    postal_code: string;
  };
};

type Checkout = ReadyCheckout | { status: "paid"; receipt: Receipt };

export function CheckoutExperience({ checkoutId }: { checkoutId: string }) {
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const handleCheckoutChange = (event: Event) => {
      const change = (event as CustomEvent<BooklyCheckoutChange>).detail;
      if (change?.checkoutId === checkoutId) setRefreshVersion((version) => version + 1);
    };
    window.addEventListener(BOOKLY_CHECKOUT_CHANGED_EVENT, handleCheckoutChange);
    return () => window.removeEventListener(BOOKLY_CHECKOUT_CHANGED_EVENT, handleCheckoutChange);
  }, [checkoutId]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/checkout/${encodeURIComponent(checkoutId)}`, {
          headers: { "x-bookly-session": getOrCreateBooklyBrowserSession() },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error(result?.error?.message ?? "Checkout could not be loaded.");
        setCheckout(result.checkout);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Checkout could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [checkoutId, refreshVersion]);

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkout || checkout.status !== "ready" || paying) return;
    setPaying(true);
    setError(null);
    try {
      const response = await fetch(`/api/checkout/${encodeURIComponent(checkoutId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bookly-session": getOrCreateBooklyBrowserSession(),
        },
        body: JSON.stringify({ payment_method_id: checkout.payment_method.id }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error?.message ?? "The demo payment did not go through.");
      setCheckout({ status: "paid", receipt: result.receipt });
      announceBooklyCartChange();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "The demo payment did not go through.");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return <main className="checkout-page"><div className="checkout-loading"><LoaderCircle size={28} className="spin" /><p>Loading Maya&apos;s secure checkout…</p></div></main>;
  }

  if (!checkout) {
    return (
      <main className="checkout-page">
        <section className="checkout-card checkout-error-card">
          <header><p>Bookly secure checkout</p><h1>We couldn&apos;t open checkout</h1></header>
          <div><p>{error}</p><Link href="/">Return to Bookly</Link></div>
        </section>
      </main>
    );
  }

  if (checkout.status === "paid") {
    const { receipt } = checkout;
    return (
      <main className="checkout-page">
        <section className="checkout-card checkout-success" aria-live="polite">
          <header><p>Payment approved</p><h1>Maya, your order is in.</h1></header>
          <div className="checkout-success-body">
            <CheckCircle2 size={48} />
            <p className="checkout-order-number">Order #{receipt.order_id}</p>
            <p>We created the order and sent it into normal processing. Estimated delivery is <strong>{receipt.estimated_delivery}</strong>.</p>
            <dl>
              <div><dt>Payment</dt><dd>{receipt.payment?.method}</dd></div>
              <div><dt>Status</dt><dd>Paid · Processing</dd></div>
              <div><dt>Total</dt><dd>{receipt.total}</dd></div>
            </dl>
            <div className="checkout-demo-note"><LockKeyhole size={15} /><span>This was a simulated payment; the order and payment records were saved to Bookly&apos;s demo database.</span></div>
            <Link className="checkout-home-link" href="/">Continue shopping</Link>
          </div>
        </section>
      </main>
    );
  }

  const address = checkout.shipping_address;
  return (
    <main className="checkout-page">
      <section className="checkout-card checkout-card-wide">
        <header>
          <div><p>Bookly secure checkout</p><h1>Complete your order</h1></div>
          <span><LockKeyhole size={14} /> Demo checkout</span>
        </header>
        <form className="checkout-layout" onSubmit={pay}>
          <div className="checkout-form-panel">
            <div className="checkout-account-note">
              <span>{checkout.customer.first_name.slice(0, 1)}{checkout.customer.last_name.slice(0, 1)}</span>
              <div><strong>Ready for {checkout.customer.first_name}</strong><p>Payment and delivery details were copied from the signed-in account. If you already asked the concierge to check out and pay, it will finish automatically after this review.</p></div>
            </div>

            <fieldset>
              <legend><CreditCard size={17} /> Payment</legend>
              <label className="checkout-field checkout-field-full">Name on card<input value={checkout.payment_method.cardholder_name} readOnly /></label>
              <label className="checkout-field checkout-field-full">Card number<input inputMode="numeric" value={checkout.payment_method.display_number} readOnly /></label>
              <label className="checkout-field">Expires<input value={checkout.payment_method.expiry} readOnly /></label>
              <label className="checkout-field">CVC<input inputMode="numeric" value="123" readOnly aria-describedby="demo-cvc-note" /></label>
              <small id="demo-cvc-note">Pre-filled test card — no real card will be charged.</small>
            </fieldset>

            <fieldset>
              <legend>Shipping address</legend>
              <label className="checkout-field checkout-field-full">Full name<input value={address.name} readOnly /></label>
              <label className="checkout-field checkout-field-full">Street address<input value={address.address1} readOnly /></label>
              {address.address2 && <label className="checkout-field checkout-field-full">Apartment or suite<input value={address.address2} readOnly /></label>}
              <label className="checkout-field">City<input value={address.city} readOnly /></label>
              <label className="checkout-field">State<input value={address.state} readOnly /></label>
              <label className="checkout-field">ZIP code<input value={address.postal_code} readOnly /></label>
            </fieldset>
          </div>

          <aside className="checkout-review-panel">
            <h2>Order summary</h2>
            <div className="checkout-items">
              {checkout.items.map((item) => (
                <article key={item.cart_item_id}>
                  <div><h3>{item.title}</h3><p>{item.author} · {item.format} · Qty {item.quantity}</p></div>
                  <strong>{item.line_total}</strong>
                </article>
              ))}
            </div>
            <dl className="checkout-totals">
              <div><dt>Subtotal</dt><dd>{checkout.totals.subtotal}</dd></div>
              <div><dt>Shipping</dt><dd>{checkout.totals.shipping}</dd></div>
              <div><dt>Tax</dt><dd>{checkout.totals.tax}</dd></div>
              <div className="checkout-total"><dt>Total</dt><dd>{checkout.totals.total}</dd></div>
            </dl>
            {error && <p className="checkout-payment-error" role="alert">{error}</p>}
            <button className="checkout-pay-button" disabled={paying} type="submit">
              {paying ? <><LoaderCircle size={17} className="spin" /> Processing…</> : <>Pay {checkout.totals.total}</>}
            </button>
            <small className="checkout-pay-disclaimer">By pressing Pay, Bookly will simulate approval and create a real demo order record.</small>
          </aside>
        </form>
      </section>
    </main>
  );
}
