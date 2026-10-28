import { requireMember } from "@/lib/clinics/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSupportUser } from "@/lib/admin/support";
import { featureForPath } from "@/lib/usage/features";

export const dynamic = "force-dynamic";

/**
 * POST { path } — components/app/usage-ping.tsx, once per cockpit page a
 * member opens. Bumps that day's usage_events row; feeds /admin → Özet.
 * Only the feature name is stored, never anything from the page. The support
 * account is skipped so "Panelini aç" doesn't count as clinic usage.
 *
 * Always 204: a usage ping must never surface an error in the panel.
 */
export async function POST(req: Request) {
  const done = new Response(null, { status: 204 });

  const member = await requireMember(req);
  if (!member.ok || isSupportUser({ email: member.user.email })) return done;

  const body = (await req.json().catch(() => null)) as { path?: unknown } | null;
  const feature = typeof body?.path === "string" ? featureForPath(body.path) : null;
  if (!feature) return done;

  const supabase = getSupabaseServer();
  if (!supabase) return done;

  const { error } = await supabase.rpc("bump_usage", {
    p_user: member.user.id,
    p_clinic: member.clinic.id,
    p_feature: feature,
  });
  if (error) console.error("[usage] bump failed:", error.message);
  return done;
}
