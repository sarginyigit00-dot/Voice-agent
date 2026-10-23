import type { getSupabaseServer } from "@/lib/supabase/server";

type Supabase = NonNullable<ReturnType<typeof getSupabaseServer>>;

/**
 * "Panelini aç": the operator opening a clinic's own panel to fix something.
 *
 * One hidden support account (SUPPORT_EMAIL) is moved into the chosen clinic
 * as its owner — every account works in exactly one clinic (clinicForUser,
 * session.tsx), so it is detached from the previous one first — and a
 * one-time sign-in token is minted for it. The browser redeems the token on
 * /auth/destek. RLS then shows the panel exactly as the clinic sees it.
 *
 * Every opening is written to support_access_log; the panel shows a
 * "Destek modu" strip (user_metadata.support), and /gizlilik says so.
 *
 * Server-only (service-role key).
 */

export function supportEmail(): string | null {
  const value = process.env.SUPPORT_EMAIL?.trim().toLowerCase();
  return value ? value : null;
}

/** True for the support account — kept out of member counts and the Users tab. */
export function isSupportUser(u: { email?: string | null; user_metadata?: Record<string, unknown> }): boolean {
  const email = supportEmail();
  return Boolean(u.user_metadata?.support) || (!!email && u.email?.toLowerCase() === email);
}

export async function openSupportSession(
  supabase: Supabase,
  clinicId: string,
): Promise<{ ok: true; tokenHash: string } | { ok: false; error: string }> {
  const email = supportEmail();
  if (!email) return { ok: false, error: "SUPPORT_EMAIL ayarlı değil." };

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id")
    .eq("id", clinicId)
    .maybeSingle();
  if (clinicError) return { ok: false, error: clinicError.message };
  if (!clinic) return { ok: false, error: "Klinik bulunamadı." };

  // First time only; afterwards it fails with "already registered", which is fine.
  await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: { support: true } });

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.user) return { ok: false, error: linkError?.message ?? "Giriş linki üretilemedi." };
  const user = link.user;

  // An account that existed before (created by hand) still gets the banner.
  if (!user.user_metadata?.support) {
    await supabase.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, support: true } });
  }

  const { error: detachError } = await supabase.from("clinic_members").delete().eq("user_id", user.id);
  if (detachError) return { ok: false, error: detachError.message };
  const { error: attachError } = await supabase
    .from("clinic_members")
    .insert({ clinic_id: clinicId, user_id: user.id, role: "owner" });
  if (attachError) return { ok: false, error: attachError.message };

  const { error: logError } = await supabase.from("support_access_log").insert({ clinic_id: clinicId });
  if (logError) console.error("[admin] failed to log support access:", logError.message);

  return { ok: true, tokenHash: link.properties.hashed_token };
}
