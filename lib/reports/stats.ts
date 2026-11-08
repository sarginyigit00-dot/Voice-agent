import { getSupabaseServer } from "@/lib/supabase/server";
import { monthStartIstanbul } from "@/lib/clinics/usage";

/**
 * Per-clinic numbers for the emailed performance report. Read by
 * /api/automation/reports; the automation app (automation/app.py) turns them
 * into the email. Counts only — no caller names, numbers or transcripts leave
 * Randevox here.
 *
 *  · monthly — the previous calendar month (Türkiye time), every active clinic.
 *  · weekly  — the previous 7 full days (Türkiye time), every active clinic. Klinik gets a short
 *              summary, Poliklinik the summary plus the detailed breakdown;
 *              the mail itself is shaped in automation/app.py by `plan`.
 */

/**
 * "Tahminen kazanılan dakika": staff time the agent took over. Kept low on
 * purpose so the mail never overclaims — a phone call the front desk would
 * have handled ≈ 3 min, a reminder they would have sent by hand ≈ 1 min.
 */
const MINUTES_PER_CALL = 3;
const MINUTES_PER_REMINDER = 1;

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
  /** 24h + 2h appointment reminders sent to patients in the period. */
  remindersSent: number;
  /** Estimated staff minutes saved (see MINUTES_PER_CALL / MINUTES_PER_REMINDER). */
  minutesSaved: number;
  /** Weekly only: minutes used so far this calendar month, for the quota line. */
  monthMinutes: number | null;
}

const DAY = 24 * 60 * 60 * 1000;

function rangeFor(kind: ReportKind, now = new Date()): { from: Date; to: Date } {
  if (kind === "weekly") {
    // Last full Monday–Sunday in Türkiye time (the job runs Monday 09:00).
    const OFFSET = 3 * 60 * 60 * 1000;
    const local = new Date(now.getTime() + OFFSET);
    const to = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET);
    return { from: new Date(to.getTime() - 7 * DAY), to };
  }
  const to = monthStartIstanbul(now);
  // One minute before this month's start is inside last month, whatever its length.
  const from = monthStartIstanbul(new Date(to.getTime() - 60 * 1000));
  return { from, to };
}

export async function buildReports(kind: ReportKind): Promise<ClinicReport[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data: clinics, error } = await supabase
    .from("clinics")
    .select("id, name, plan, notify_email, minutes_quota")
    .eq("status", "active")
    .not("notify_email", "is", null);
  if (error) {
    console.error("[reports] clinic lookup failed:", error.message);
    return [];
  }

  const { from, to } = rangeFor(kind);

  // Weekly mails show "bu ay X / kota dk": one aggregate for every clinic.
  const monthSeconds = new Map<string, number>();
  if (kind === "weekly") {
    const usage = await supabase.rpc("clinic_usage_since", { since: monthStartIstanbul().toISOString() });
    if (usage.error) console.error("[reports] month usage lookup failed:", usage.error.message);
    for (const u of (usage.data ?? []) as { clinic_id: string; seconds: number }[]) {
      monthSeconds.set(u.clinic_id, Number(u.seconds ?? 0));
    }
  }
  const reports: ClinicReport[] = [];

  for (const c of clinics ?? []) {
    const email = String(c.notify_email ?? "").trim();
    if (!email) continue;

    const [calls, booked, cancelled, reminded24, reminded2] = await Promise.all([
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
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", c.id)
        .gte("reminder_24h_sent_at", from.toISOString())
        .lt("reminder_24h_sent_at", to.toISOString()),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", c.id)
        .gte("reminder_2h_sent_at", from.toISOString())
        .lt("reminder_2h_sent_at", to.toISOString()),
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

    const callCount = calls.data?.length ?? 0;
    const remindersSent = (reminded24.count ?? 0) + (reminded2.count ?? 0);

    reports.push({
      clinicId: c.id as string,
      clinicName: c.name as string,
      email,
      plan: String(c.plan ?? ""),
      kind,
      from: from.toISOString(),
      to: to.toISOString(),
      calls: callCount,
      minutes: Math.ceil(seconds / 60),
      quota: Number(c.minutes_quota ?? 0),
      outcomes,
      appointmentsBooked: booked.count ?? 0,
      appointmentsCancelled: cancelled.count ?? 0,
      remindersSent,
      minutesSaved: callCount * MINUTES_PER_CALL + remindersSent * MINUTES_PER_REMINDER,
      monthMinutes: kind === "weekly" ? Math.ceil((monthSeconds.get(c.id as string) ?? 0) / 60) : null,
    });
  }
  return reports;
}
