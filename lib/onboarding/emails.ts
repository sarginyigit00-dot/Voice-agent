import { after } from "next/server";
import appConfig from "@/app.config";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Onboarding emails to a clinic, sent through Brevo with templates kept in the
 * Brevo account (Transactional → Templates, tag "onboarding"):
 *
 *  · welcome — the operator marks the clinic "Aktif" in /admin (payment came in)
 *  · ready   — the operator runs "Numaraya bağla": the line answers, setup is done
 *  · day3    — 3 days after `ready`: look through the call log
 *  · day7    — 7 days after `ready`: a tip (fill in /klinik) and a question
 *
 * day3/day7 are sent by /api/automation/onboarding, polled daily by the
 * automation app. Each kind goes to a clinic at most once: the row in
 * `onboarding_emails` is claimed before sending and released if the send fails.
 * Best effort like the other mail here — never throws, and without
 * BREVO_API_KEY it simply doesn't send.
 */

export type OnboardingKind = "welcome" | "ready" | "day3" | "day7";

/** Brevo template ids (Transactional → Templates). */
const TEMPLATE_IDS: Record<OnboardingKind, number> = {
  welcome: 1,
  ready: 2,
  day3: 3,
  day7: 4,
};

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const DAY = 24 * 60 * 60 * 1000;

async function sendTemplate(to: string, kind: OnboardingKind, clinicName: string): Promise<boolean> {
  const key = process.env.BREVO_API_KEY?.trim();
  if (!key) return false;
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        templateId: TEMPLATE_IDS[kind],
        to: [{ email: to }],
        params: { CLINIC: clinicName, PANEL_URL: `https://www.${appConfig.domain}` },
        tags: ["onboarding", kind],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`[onboarding] Brevo rejected ${kind}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.ok;
  } catch (e) {
    console.error("[onboarding] could not reach Brevo:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Sends one onboarding email unless this clinic already got it. True when it went out now. */
export async function sendOnboardingEmail(clinicId: string, kind: OnboardingKind): Promise<boolean> {
  const supabase = getSupabaseServer();
  if (!supabase || !process.env.BREVO_API_KEY?.trim()) return false;

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, notify_email")
    .eq("id", clinicId)
    .maybeSingle();
  const to = String(clinic?.notify_email ?? "").trim();
  if (!clinic || !to) return false;

  // Claim first: a second save or a parallel poll finds the row and stops here.
  const { data: claimed, error } = await supabase
    .from("onboarding_emails")
    .upsert({ clinic_id: clinicId, kind }, { onConflict: "clinic_id,kind", ignoreDuplicates: true })
    .select("clinic_id");
  if (error || !claimed?.length) return false;

  if (await sendTemplate(to, kind, clinic.name)) return true;
  await supabase.from("onboarding_emails").delete().eq("clinic_id", clinicId).eq("kind", kind);
  return false;
}

/** Sends after the response inside a request (the admin panel never waits on Brevo), straight away otherwise. */
export function queueOnboardingEmail(clinicId: string, kind: OnboardingKind): void {
  const run = () => sendOnboardingEmail(clinicId, kind).catch((e) => console.error(`[onboarding] ${kind} failed:`, e));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** The day-3 and day-7 emails that are due, counted from each clinic's `ready` email. */
export async function sendDueOnboardingEmails(now = new Date()): Promise<Record<"day3" | "day7", number>> {
  const sent = { day3: 0, day7: 0 };
  const supabase = getSupabaseServer();
  if (!supabase) return sent;

  const { data: rows, error } = await supabase.from("onboarding_emails").select("clinic_id, kind, sent_at");
  if (error || !rows) return sent;

  const readyAt = new Map<string, number>();
  const done = new Set<string>();
  for (const r of rows) {
    if (r.kind === "ready") readyAt.set(r.clinic_id, Date.parse(r.sent_at));
    done.add(`${r.clinic_id}:${r.kind}`);
  }

  // A clinic that stopped paying gets no more "how is it going" mail.
  const { data: active } = await supabase
    .from("clinics")
    .select("id")
    .in("id", [...readyAt.keys()])
    .eq("billing_status", "active");
  const activeIds = new Set((active ?? []).map((c) => c.id as string));

  for (const [clinicId, at] of readyAt) {
    if (!activeIds.has(clinicId)) continue;
    for (const [kind, days] of [["day3", 3], ["day7", 7]] as const) {
      if (done.has(`${clinicId}:${kind}`) || now.getTime() - at < days * DAY) continue;
      if (await sendOnboardingEmail(clinicId, kind)) sent[kind]++;
    }
  }
  return sent;
}
