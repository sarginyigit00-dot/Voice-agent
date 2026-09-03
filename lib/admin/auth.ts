import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The /admin panel's whole auth story: one shared password in ADMIN_PASSWORD,
 * exchanged for a signed cookie. Deliberately NOT Supabase auth — there is no
 * `profiles` table in supabase/schema.sql, so there's no role to check against,
 * and the panel is for the operator alone rather than for accounts.
 *
 * The cookie can't just say "yes": anyone could forge that. It carries its own
 * expiry, signed with the password itself as the HMAC key — you can't mint one
 * without knowing the password, and you can't extend one you were given.
 *
 * Server-only (node:crypto + next/headers). Never import from a client component.
 */

export const ADMIN_COOKIE = "randevox_admin";

/** 12 hours — long enough for a working session, short enough to not linger. */
const TTL_SECONDS = 12 * 60 * 60;

function password(): string | null {
  const value = process.env.ADMIN_PASSWORD;
  return value && value.length > 0 ? value : null;
}

/** False when ADMIN_PASSWORD is unset — /admin then refuses to open at all. */
export function isAdminConfigured(): boolean {
  return password() !== null;
}

/**
 * Constant-time password compare. Both sides are hashed first so that
 * timingSafeEqual always gets equal-length buffers — otherwise a length
 * mismatch would throw and leak the password length through the error path.
 */
export function checkPassword(input: string): boolean {
  const secret = password();
  if (!secret) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

function sign(exp: number, secret: string): string {
  return createHmac("sha256", secret).update(String(exp)).digest("hex");
}

/** `"<unix-expiry>.<hmac>"` — the value that goes in the httpOnly cookie. */
export function createAdminToken(): { value: string; maxAge: number } {
  const secret = password();
  if (!secret) throw new Error("ADMIN_PASSWORD is not set");
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return { value: `${exp}.${sign(exp, secret)}`, maxAge: TTL_SECONDS };
}

export function verifyAdminToken(value: string | undefined): boolean {
  const secret = password();
  if (!secret || !value) return false;

  const [rawExp, mac] = value.split(".");
  const exp = Number(rawExp);
  if (!mac || !Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;

  const expected = sign(exp, secret);
  if (mac.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

/** The one gate both the /admin page and the admin API routes go through. */
export async function requireAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}
