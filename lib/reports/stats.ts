import { getSupabaseServer } from "@/lib/supabase/server";
import { monthStartIstanbul } from "@/lib/clinics/usage";

/**
 * Per-clinic numbers for the emailed performance report. Read by
 * /api/automation/reports; the automation app (automation/app.py) turns them
 * into the email. Counts only — no caller names, numbers or transcripts leave
 * Randevox here.
 *
 *  · monthly — the previous calendar month (Türkiye time), every active clinic.
 *  · weekly  — the last 7 days, Poliklinik clinics only (the package's perk).
 */

export type ReportKind = "weekly" | "monthly";

export const isReportKind = (v: unknown): v is ReportKind => v === "weekly" || v === "monthly";

export interface ClinicReport {
  clinicId: string;
  clinicName: string;
  email: string;
  plan: string;
  kind: ReportKind;
  from: string;
  to: string;
  calls: number;
  /** Talk time, rounded up to whole minutes. */
  minutes: number;
  quota: number;
  outcomes: Record<string, number>;
  appointmentsBooked: number;
  appointmentsCancelled: number;
}

const DAY = 24 * 60 * 60 * 1000;

function rangeFor(kind: ReportKind, now = new Date()): { from: Date; to: Date } {
  if (kind === "weekly") return { from: new Date(now.getTime() - 7 * DAY), to: now };
  const to = monthStartIstanbul(now);
  // One minute before this month's start is inside last month, whatever its length.
  const from = monthStartIstanbul(new Date(to.getTime() - 60 * 1000));
  return { from, to };
}

export async function buildReports(kind: ReportKind): Promise<ClinicReport[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  let query = supabase
    .from("clinics")
    .select("id, name, plan, notify_email, minutes_quota")
    .eq("status", "active")
    .not("notify_email", "is", null);
  if (kind === "weekly") query = query.eq("plan", "poliklinik");
  const { data: clinics, error } = await query;
  if (error) {
    console.error("[reports] clinic lookup failed:", error.message);
    return [];
  }

  const { from, to } = rangeFor(kind);
  const reports: ClinicReport[] = [];

  for (const c of clinics ?? []) {
    const email = String(c.notify_email ?? "").trim();
    if (!email) continue;

    const [calls, booked, cancelled] = await Promise.all([
      supabase
        .from("calls")
        .select("outcome, duration_sec")
        .eq("clinic_id", c.id)
        .gte("started_at", from.toISOString())
        .lt("started_at", to.toISOString())
        .limit(20000),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", c.id)
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString()),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", c.id)
        .eq("status", "cancelled")
        .gte("cancelled_at", from.toISOString())
        .lt("cancelled_at", to.toISOString()),
    ]);
    if (calls.error) {
      console.error(`[reports] calls lookup failed for ${c.id}:`, calls.error.message);
      continue;
    }

    const outcomes: Record<string, number> = {};
    let seconds = 0;
    for (const row of calls.data ?? []) {
      const key = String(row.outcome ?? "resolved");
      outcomes[key] = (outcomes[key] ?? 0) + 1;
      seconds += Number(row.duration_sec ?? 0);
    }

    reports.push({
      clinicId: c.id as string,
      clinicName: c.name as string,
      email,
      plan: String(c.plan ?? ""),
      kind,
      from: from.toISOString(),
      to: to.toISOString(),
      calls: calls.data?.length ?? 0,
      minutes: Math.ceil(seconds / 60),
      quota: Number(c.minutes_quota ?? 0),
      outcomes,
      appointmentsBooked: booked.count ?? 0,
      appointmentsCancelled: cancelled.count ?? 0,
    });
  }
  return reports;
}
