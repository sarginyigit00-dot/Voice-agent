import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Verifies the request carries a real, currently-valid Supabase session —
 * the one check every route holding the service-role key must do before
 * touching the database, since that key bypasses RLS entirely.
 *
 * Expects `Authorization: Bearer <access_token>`, the signed-in user's own
 * token (see lib/supabase/authed-fetch.ts on the client side). Returns null
 * on anything short of a verified user — no token, an expired one, Supabase
 * not configured — so callers can treat every failure mode the same way:
 * reject the request, never fall back to trusting it.
 */
export async function requireUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}
