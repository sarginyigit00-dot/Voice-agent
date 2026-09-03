import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

/** POST → drops the admin cookie. No password needed to log yourself out. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
