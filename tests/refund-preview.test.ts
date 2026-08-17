import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { refundPreviewFromOutput } from "../lib/refund-preview";

describe("Refund receipt sidecar", () => {
  test("maps a successful refund tool result into business-friendly receipt details", () => {
    const preview = refundPreviewFromOutput({
      ok: true,
      refund: {
        refund_id: "rf_1234567890",
        order_id: "5678",
        status: "succeeded",
        simulated_payment_processor: true,
        payment_reference: "sim_pay_123456",
        amount: "$14.03",
        reason: "The paperback arrived damaged.",
        items: [{ title: "A Glass Horizon", quantity: 1 }],
        expected_bank_timing: "5-10 business days",
        created_at: "2026-08-15T20:00:00.000Z",
      },
    });

    assert.deepEqual(preview, {
      refundId: "rf_1234567890",
      orderId: "5678",
      status: "succeeded",
      amount: "$14.03",
      reason: "The paperback arrived damaged.",
      items: [{ title: "A Glass Horizon", quantity: 1 }],
      expectedBankTiming: "5-10 business days",
      createdAt: "2026-08-15T20:00:00.000Z",
      paymentReference: "sim_pay_123456",
      simulatedPaymentProcessor: true,
    });
  });

  test("does not open a receipt for failed or malformed refund results", () => {
    assert.equal(refundPreviewFromOutput({ ok: false, error: { code: "QUOTE_EXPIRED" } }), null);
    assert.equal(refundPreviewFromOutput({ ok: true, refund: { status: "succeeded" } }), null);
  });
});
