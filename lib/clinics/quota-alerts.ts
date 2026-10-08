import { getSupabaseServer } from "@/lib/supabase/server";
import { monthStartIstanbul } from "@/lib/clinics/usage";

/**
 * Quota warnings: a clinic that has used 80 % / 100 % of its monthly minutes
 * gets one email per level per month. Read by /api/automation/quota-alerts;
 * the automation app (automation/app.py, `quota_alerts`) sends the mail and
 * acknowledges it, which records the level on the clinic row so the next
 * daily pass skips it.
 */

/** Level → share of the quota that triggers it. */
export const QUOTA_LEVELS = { 1: 0.8, 2: 1 } as const;
export type QuotaLevel = keyof typeof QUOTA_LEVELS;

export const isQuotaLevel = (v: unknown): v is QuotaLevel => v === 1 || v === 2;

export interface QuotaAlert {
  clinicId: string;
  clinicName: string;
  email: string;
  level: QuotaLevel;
  minutes: number;
  quota: number;
}

/** 'YYYY-MM' of the current month in Türkiye (UTC+3, no DST). */
export function currentMonthKey(now = new Date()): string {
  const local = new Date(monthStartIstanbul(now).getTime() + 3 * 60 * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function pendingQuotaAlerts(): Promise<QuotaAlert[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const month = currentMonthKey();
  const [clinics, usage] = await Promise.all([
    supabase
      .from("clinics")
      .select("id, name, notify_email, minutes_quota, quota_alert_level, quota_alert_month")
      .eq("status", "active")
      .not("notify_email", "is", null),
    supabase.rpc("clinic_usage_since", { since: monthStartIstanbul().toISOString() }),
  ]);
  if (clinics.error || usage.error) {
    console.error("[quota-alerts] lookup failed:", clinics.error?.message ?? usage.error?.message);
    return [];
  }

  const seconds = new Map(
    ((usage.data ?? []) as { clinic_id: string; seconds: number }[]).map((u) => [u.clinic_id, Number(u.seconds)]),
  );

  const alerts: QuotaAlert[] = [];
  for (const c of clinics.data ?? []) {
    const email = String(c.notify_email ?? "").trim();
    const quota = Number(c.minutes_quota ?? 0);
    if (!email || quota <= 0) continue;

    const minutes = Math.ceil((seconds.get(c.id as string) ?? 0) / 60);
    const level: 0 | QuotaLevel = minutes >= quota * QUOTA_LEVELS[2] ? 2 : minutes >= quota * QUOTA_LEVELS[1] ? 1 : 0;
    const alreadySent = c.quota_alert_month === month ? Number(c.quota_alert_level ?? 0) : 0;
    if (level === 0 || level <= alreadySent) continue;

    alerts.push({ clinicId: c.id as string, clinicName: c.name as string, email, level, minutes, quota });
  }
  return alerts;
}

/** Records that `level` was mailed. Never lowers a level already stored for this month. */
export async function markQuotaAlertSent(clinicId: string, level: QuotaLevel): Promise<boolean> {
  const supabase = getSupabaseServer();
  if (!supabase) return false;

  const month = currentMonthKey();
  const { data, error } = await supabase
    .from("clinics")
    .select("quota_alert_level, quota_alert_month")
    .eq("id", clinicId)
    .maybeSingle();
  if (error || !data) return false;

  const stored = data.quota_alert_month === month ? Number(data.quota_alert_level ?? 0) : 0;
  if (stored >= level) return true;

  const { error: updateError } = await supabase
    .from("clinics")
    .update({ quota_alert_level: level, quota_alert_month: month })
    .eq("id", clinicId);
  if (updateError) {
    console.error("[quota-alerts] marking sent failed:", updateError.message);
    return false;
  }
  return true;
}
