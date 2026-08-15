import { NextResponse } from "next/server";
import { z } from "zod";
import { BOOKLY_AUTH_COOKIE, customerSessionFromRequest } from "@/lib/auth";
import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionIdSchema = z.string().min(8).max(128);

type CustomerRow = {
  id: number;
  email: string;
  first_name: string;
};

export async function GET(request: Request) {
  const sessionId = request.headers.get("x-bookly-session");
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) {
    return NextResponse.json({ authenticated: false, error: "Invalid browser session." }, { status: 400 });
  }

  const session = customerSessionFromRequest(request, parsed.data);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const db = await getDatabase();
  const customer = db.prepare(`
    SELECT id, email, first_name
    FROM customers
    WHERE id = ?
  `).get(session.customerId) as CustomerRow | undefined;
  if (!customer) {
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { authenticated: true, customer: { email: customer.email, firstName: customer.first_name } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(BOOKLY_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
