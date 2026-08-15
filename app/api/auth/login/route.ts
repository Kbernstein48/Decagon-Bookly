import { NextResponse } from "next/server";
import { z } from "zod";
import { BOOKLY_AUTH_COOKIE, createCustomerSessionToken } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(500),
  sessionId: z.string().min(8).max(128),
});

type CustomerRow = {
  id: number;
  email: string;
  first_name: string;
};

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ authenticated: false, error: "Enter a valid email address and password." }, { status: 400 });
  }

  // This prototype intentionally accepts any non-empty password and never stores or logs it.
  const db = await getDatabase();
  const customer = db.prepare(`
    SELECT id, email, first_name
    FROM customers
    WHERE lower(email) = lower(?)
  `).get(parsed.data.email) as CustomerRow | undefined;

  if (!customer) {
    return NextResponse.json(
      { authenticated: false, error: "We couldn't sign in with that email. Check the address used at checkout." },
      { status: 401 },
    );
  }

  try {
    const token = createCustomerSessionToken(customer.id, parsed.data.sessionId);
    const response = NextResponse.json({
      authenticated: true,
      customer: { email: customer.email, firstName: customer.first_name },
    });
    response.cookies.set(BOOKLY_AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Bookly session creation failed", error);
    return NextResponse.json(
      { authenticated: false, error: "Account sign-in is temporarily unavailable." },
      { status: 503 },
    );
  }
}
