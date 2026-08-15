export const BOOKLY_CART_CHANGED_EVENT = "bookly-cart-changed";

export function announceBooklyCartChange() {
  window.dispatchEvent(new CustomEvent(BOOKLY_CART_CHANGED_EVENT));
}
