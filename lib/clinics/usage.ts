import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * A clinic's minutes this calendar month against its package — the number
 * the invoice is cut from. Shared by /admin (every clinic) and the clinic's
 * own dashboard meter (app/api/clinic/usage), so both always agree.
 */

/** Start of the current month in Türkiye — UTC+3 all year, no DST since 2016. */
export function monthStartIstanbul(now = new Date()): Date {
  const OFFSET = 3 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + OFFSET);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET);
}

export interface ClinicUsage {
  /** Included minutes per month (clinics.minutes_quota). */
  quota: number;
  /** Started minutes, rounded up per clinic — same as the admin view. */
  minutes: number;
  calls: number;
  since: string;
}

export async function usageFor(clinicId: string): Promise<ClinicUsage | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const since = monthStartIstanbul().toISOString();
  const [clinic, usage] = await Promise.all([
    supabase.from("clinics").select("minutes_quota").eq("id", clinicId).maybeSingle(),
    // Aggregates every clinic; fine at this scale, and the only reader of call rows stays SQL.
    supabase.rpc("clinic_usage_since", { since }),
  ]);
  if (clinic.error || usage.error) {
    console.error("[usage] lookup failed:", clinic.error?.message ?? usage.error?.message);
    return null;
  }
  if (!clinic.data) return null;

  const row = ((usage.data ?? []) as { clinic_id: string; seconds: number; calls: number }[]).find(
    (u) => u.clinic_id === clinicId,
  );
  return {
    quota: Number(clinic.data.minutes_quota ?? 0),
    minutes: Math.ceil(Number(row?.seconds ?? 0) / 60),
    calls: Number(row?.calls ?? 0),
    since,
  };
}
