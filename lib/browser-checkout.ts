export const BOOKLY_CHECKOUT_CHANGED_EVENT = "bookly-checkout-changed";

export type BooklyCheckoutChange = {
  checkoutId: string;
};

export function announceBooklyCheckoutChange(checkoutId: string) {
  window.dispatchEvent(new CustomEvent<BooklyCheckoutChange>(BOOKLY_CHECKOUT_CHANGED_EVENT, {
    detail: { checkoutId },
  }));
}
