import { z } from "zod";
import { customerSessionFromRequest } from "@/lib/auth";
import {
  CheckoutError,
  completeSimulatedCheckout,
  getCheckoutReview,
} from "@/lib/checkout";
import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionSchema = z.string().min(8).max(128);
const checkoutIdSchema = z.string().regex(/^checkout_[a-z0-9]{16}$/);
const paymentSchema = z.object({ payment_method_id: z.string().min(1).max(100) });

function checkoutError(error: unknown) {
  if (error instanceof CheckoutError) {
    return Response.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error("Bookly checkout failed", error);
  return Response.json(
    { ok: false, error: { code: "CHECKOUT_UNAVAILABLE", message: "Checkout is temporarily unavailable." } },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

async function checkoutContext(request: Request, id: string) {
  const sessionId = sessionSchema.safeParse(request.headers.get("x-bookly-session"));
  const checkoutId = checkoutIdSchema.safeParse(id);
  if (!sessionId.success || !checkoutId.success) {
    throw new CheckoutError("INVALID_CHECKOUT", "This checkout link is invalid.", 400);
  }
  const customerSession = customerSessionFromRequest(request, sessionId.data);
  if (!customerSession) {
    throw new CheckoutError("AUTHENTICATION_REQUIRED", "Sign in to Maya's account again to complete checkout.", 401);
  }
  return {
    db: await getDatabase(),
    checkoutId: checkoutId.data,
    sessionId: sessionId.data,
    customerId: customerSession.customerId,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await checkoutContext(request, id);
    return Response.json(
      { ok: true, checkout: getCheckoutReview(context.db, context.checkoutId, context.sessionId, context.customerId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return checkoutError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await checkoutContext(request, id);
    const parsed = paymentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new CheckoutError("INVALID_PAYMENT_METHOD", "Choose the saved demo payment method.", 400);
    }
    const result = completeSimulatedCheckout(context.db, {
      checkoutId: context.checkoutId,
      sessionId: context.sessionId,
      customerId: context.customerId,
      paymentMethodId: parsed.data.payment_method_id,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return checkoutError(error);
  }
}
