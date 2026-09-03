import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPassword, createAdminToken, isAdminConfigured } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

/**
 * POST { password } → sets the signed admin cookie.
 *
 * Fails closed like /api/cron/crm-sync: with no ADMIN_PASSWORD configured the
 * panel has no password to check, so it stays shut rather than open.
 */
export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin paneli yapılandırılmamış." }, { status: 503 });
  }

  let input = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    input = typeof body.password === "string" ? body.password : "";
  } catch {
    // Malformed body — treated as a wrong password, not a distinct error, so
    // the response shape can't be used to probe the endpoint.
  }

  if (!checkPassword(input)) {
    // Small fixed delay: brute-forcing over the network is already slow, but
    // there's no reason to answer a wrong password instantly either.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Şifre hatalı." }, { status: 401 });
  }

  const { value, maxAge } = createAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}
