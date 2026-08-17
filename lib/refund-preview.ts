export type RefundPreview = {
  refundId: string;
  orderId: string;
  status: "succeeded";
  amount: string;
  reason: string;
  items: Array<{ title: string; quantity: number }>;
  expectedBankTiming: string;
  createdAt: string;
  paymentReference: string;
  simulatedPaymentProcessor: true;
};

export function refundPreviewFromOutput(output: unknown): RefundPreview | null {
  if (!output || typeof output !== "object") return null;
  const result = output as {
    ok?: unknown;
    refund?: {
      refund_id?: unknown;
      order_id?: unknown;
      status?: unknown;
      amount?: unknown;
      reason?: unknown;
      items?: unknown;
      expected_bank_timing?: unknown;
      created_at?: unknown;
      payment_reference?: unknown;
      simulated_payment_processor?: unknown;
    };
  };
  const refund = result.refund;
  if (
    result.ok !== true ||
    refund?.status !== "succeeded" ||
    refund.simulated_payment_processor !== true ||
    typeof refund.refund_id !== "string" ||
    typeof refund.order_id !== "string" ||
    typeof refund.amount !== "string" ||
    typeof refund.reason !== "string" ||
    typeof refund.expected_bank_timing !== "string" ||
    typeof refund.created_at !== "string" ||
    typeof refund.payment_reference !== "string" ||
    !Array.isArray(refund.items)
  ) return null;

  const items = refund.items.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as { title?: unknown; quantity?: unknown };
    return typeof candidate.title === "string" &&
      typeof candidate.quantity === "number" &&
      Number.isInteger(candidate.quantity) &&
      candidate.quantity > 0
      ? [{ title: candidate.title, quantity: candidate.quantity }]
      : [];
  });
  if (items.length !== refund.items.length || items.length === 0) return null;

  return {
    refundId: refund.refund_id,
    orderId: refund.order_id,
    status: refund.status,
    amount: refund.amount,
    reason: refund.reason,
    items,
    expectedBankTiming: refund.expected_bank_timing,
    createdAt: refund.created_at,
    paymentReference: refund.payment_reference,
    simulatedPaymentProcessor: true,
  };
}
