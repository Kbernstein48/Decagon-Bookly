"use client";

import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getOrCreateBooklyBrowserSession } from "@/lib/browser-auth";
import { BOOKLY_CART_CHANGED_EVENT } from "@/lib/browser-cart";

type CartItem = {
  cart_item_id: string;
  title: string;
  author: string;
  format: string;
  quantity: number;
  unit_price: string;
  line_total: string;
};
type Cart = { item_count: number; items: CartItem[]; subtotal: string; shipping: string; total: string; free_shipping_remaining: string };

const subscribeToBrowser = () => () => {};
const getBrowserSnapshot = () => true;
const getServerSnapshot = () => false;

export function CartExperience() {
  const [open, setOpen] = useState(false);
  const portalReady = useSyncExternalStore(subscribeToBrowser, getBrowserSnapshot, getServerSnapshot);
  const [cart, setCart] = useState<Cart | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sessionId = getOrCreateBooklyBrowserSession();
    const response = await fetch("/api/cart", { headers: { "x-bookly-session": sessionId }, cache: "no-store" });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) setCart(result.cart);
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => { void refresh(); }, 0);
    const changed = () => { void refresh(); setOpen(true); };
    window.addEventListener(BOOKLY_CART_CHANGED_EVENT, changed);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener(BOOKLY_CART_CHANGED_EVENT, changed);
    };
  }, [refresh]);

  useEffect(() => {
    document.body.classList.toggle("cart-open", open);
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("cart-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const mutate = useCallback(async (body: object, itemId: string) => {
    setBusyItem(itemId);
    setError(null);
    try {
      const response = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-bookly-session": getOrCreateBooklyBrowserSession() },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.ok) {
        if (result.cart) setCart(result.cart);
        if (result.checkout?.checkout_url) setCheckoutUrl(result.checkout.checkout_url);
      } else {
        setError(result?.error?.message ?? result?.error ?? "That cart action could not be completed.");
      }
    } catch {
      setError("That cart action could not be completed.");
    } finally {
      setBusyItem(null);
    }
  }, []);

  return (
    <>
      <button className="icon-button bag-button" aria-label={`Shopping bag, ${cart?.item_count ?? 0} items`} onClick={() => setOpen(true)}>
        <ShoppingBag size={20} /><span>{cart?.item_count ?? 0}</span>
      </button>
      {portalReady && createPortal(<>
        {open && <button className="cart-backdrop" aria-label="Close shopping bag" onClick={() => setOpen(false)} />}
        <aside className={`cart-drawer ${open ? "open" : ""}`} aria-label="Shopping bag" aria-hidden={!open}>
        <header>
          <div><p>Your shelf</p><h2>Shopping bag</h2></div>
          <button aria-label="Close shopping bag" onClick={() => setOpen(false)}><X size={20} /></button>
        </header>
        <div className="cart-drawer-body">
          {!cart?.items.length ? (
            <div className="cart-empty"><ShoppingBag size={29} /><h3>Your bag is ready for a story.</h3><p>Ask Bookly Concierge for a recommendation and it can add the exact format here.</p></div>
          ) : cart.items.map((item) => (
            <article className="cart-line" key={item.cart_item_id}>
              <div className="cart-line-cover">{item.title.slice(0, 1)}</div>
              <div className="cart-line-copy">
                <h3>{item.title}</h3><p>{item.author} · {item.format}</p><strong>{item.line_total}</strong>
                <div className="cart-line-actions">
                  <div>
                    <button aria-label={`Decrease ${item.title} quantity`} disabled={busyItem === item.cart_item_id || item.quantity === 1} onClick={() => void mutate({ action: "update", cart_item_id: item.cart_item_id, quantity: item.quantity - 1 }, item.cart_item_id)}><Minus size={12} /></button>
                    <span>{item.quantity}</span>
                    <button aria-label={`Increase ${item.title} quantity`} disabled={busyItem === item.cart_item_id} onClick={() => void mutate({ action: "update", cart_item_id: item.cart_item_id, quantity: item.quantity + 1 }, item.cart_item_id)}><Plus size={12} /></button>
                  </div>
                  <button aria-label={`Remove ${item.title}`} disabled={busyItem === item.cart_item_id} onClick={() => void mutate({ action: "remove", cart_item_id: item.cart_item_id }, item.cart_item_id)}><Trash2 size={13} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <footer>
          <div><span>Subtotal</span><strong>{cart?.subtotal ?? "$0.00"}</strong></div>
          <div><span>Shipping</span><strong>{cart?.shipping ?? "Free"}</strong></div>
          <div className="cart-total"><span>Total</span><strong>{cart?.total ?? "$0.00"}</strong></div>
          {error && <p className="cart-checkout-error" role="alert">{error}</p>}
          {checkoutUrl ? <Link className="cart-checkout" href={checkoutUrl}>Review checkout</Link> : <button className="cart-checkout" disabled={!cart?.items.length || busyItem === "checkout"} onClick={() => void mutate({ action: "checkout" }, "checkout")}>Begin checkout</button>}
          <p>Bookly Concierge can submit only after you review and explicitly confirm the checkout details.</p>
        </footer>
        </aside>
      </>, document.body)}
    </>
  );
}
