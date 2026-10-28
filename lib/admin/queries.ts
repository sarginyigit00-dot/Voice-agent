import { getSupabaseServer } from "@/lib/supabase/server";
import { listClinics, type AdminClinic } from "@/lib/admin/clinics";
import { isSupportUser, supportEmail } from "@/lib/admin/support";
import { featureLabel } from "@/lib/usage/features";

/**
 * Everything the /admin panel shows, read with the service-role client.
 *
 * Accounts come from Supabase's own admin API (`auth.users`) rather than a
 * `profiles` table — supabase/schema.sql doesn't define one, so auth.users is
 * the only place a signup actually lands.
 *
 * Account fields only. `appointments` is counted with a head-only query, so
 * no row content is read; `calls`, `crm_records` and appointment detail stay
 * out of this file entirely — we hold those as a processor for the clinic
 * (app/gizlilik/page.tsx §2), not as ours to browse.
 */

export interface AdminUser {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  banned: boolean;
}

/**
 * A "Kliniğinizde deneyin" request (/demo-talep). Our own prospects, who
 * handed us their details directly — so unlike call data we're the controller
 * here, and listing and exporting them is ordinary lead handling.
 */
export interface DemoRequest {
  id: string;
  clinicName: string;
  contactName: string;
  phone: string;
  email: string | null;
  note: string | null;
  createdAt: string;
}

/** A message from the cockpit's feedback widget. Written by the customer to us, so ours to read. */
export interface FeedbackEntry {
  id: string;
  category: "fikir" | "hata" | "soru" | "diger";
  message: string;
  userEmail: string | null;
  clinicName: string | null;
  pagePath: string | null;
  attachmentName: string | null;
  /** Short-lived signed URL; the bucket is private. */
  attachmentUrl: string | null;
  status: "new" | "read" | "done";
  createdAt: string;
}

/** A person in the Özet tab's lists. */
export interface ActivityUser {
  id: string;
  email: string | null;
  clinicName: string | null;
  /** Last panel visit or sign-in, whichever is later; null = never. */
  lastSeenAt: string | null;
  createdAt: string;
}

/** The /admin "Özet" tab — panel usage over the last 7 days (usage_events). */
export interface AdminActivity {
  /** False when usage_events has no rows yet (tracking just started). */
  tracking: boolean;
  /** First day with any usage row, YYYY-MM-DD. */
  since: string | null;
  activeUsers: number;
  topFeatures: { label: string; hits: number; users: number }[];
  inactive: ActivityUser[];
  newThisWeek: ActivityUser[];
}

export interface AdminOverview {
  /** False when SUPABASE_SERVICE_ROLE_KEY / URL are missing — panel says so. */
  connected: boolean;
  /** SUPPORT_EMAIL is set — "Panelini aç" works. */
  supportReady: boolean;
  users: AdminUser[];
  demoRequests: DemoRequest[];
  feedback: FeedbackEntry[];
  clinics: AdminClinic[];
  activity: AdminActivity;
  totals: {
    users: number;
    newToday: number;
    unconfirmed: number;
    /** A bare row count — no appointment content is read here, see below. */
    appointments: number | null;
  };
}

const EMPTY: AdminOverview = {
  connected: false,
  supportReady: false,
  users: [],
  demoRequests: [],
  feedback: [],
  clinics: [],
  activity: { tracking: false, since: null, activeUsers: 0, topFeatures: [], inactive: [], newThisWeek: [] },
  totals: { users: 0, newToday: 0, unconfirmed: 0, appointments: null },
};

/** Row count without pulling the rows. Null when the table/query fails. */
async function countRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  table: string,
): Promise<number | null> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) {
    console.error(`[admin] failed to count ${table}:`, error.message);
    return null;
  }
  return count ?? 0;
}

/**
 * Demo requests, newest first. RLS has no policies on this table on purpose
 * (supabase/schema.sql), so the service-role client is the only thing that
 * can read it — which is exactly why it belongs here and nowhere in the
 * cockpit.
 */
async function listDemoRequests(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
): Promise<DemoRequest[]> {
  const { data, error } = await supabase
    .from("demo_requests")
    .select("id, clinic_name, contact_name, phone, email, note, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[admin] failed to list demo_requests:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    clinicName: r.clinic_name as string,
    contactName: r.contact_name as string,
    phone: r.phone as string,
    email: (r.email as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

async function listFeedback(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select(
      "id, category, message, user_email, page_path, attachment_path, attachment_name, status, created_at, clinics(name)",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    console.error("[admin] failed to list feedback:", error.message);
    return [];
  }
  return Promise.all(
    (data ?? []).map(async (r) => {
      const clinic = (Array.isArray(r.clinics) ? r.clinics[0] : r.clinics) as { name?: string } | null;
      let attachmentUrl: string | null = null;
      if (r.attachment_path) {
        const signed = await supabase.storage
          .from("feedback-attachments")
          .createSignedUrl(r.attachment_path as string, 3600);
        attachmentUrl = signed.data?.signedUrl ?? null;
      }
      return {
        id: r.id as string,
        category: r.category as FeedbackEntry["category"],
        message: r.message as string,
        userEmail: (r.user_email as string | null) ?? null,
        clinicName: clinic?.name ?? null,
        pagePath: (r.page_path as string | null) ?? null,
        attachmentName: (r.attachment_name as string | null) ?? null,
        attachmentUrl,
        status: r.status as FeedbackEntry["status"],
        createdAt: r.created_at as string,
      };
    }),
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ISTANBUL_OFFSET = 3 * 60 * 60 * 1000;

/** YYYY-MM-DD of an instant in Istanbul — the calendar usage_events.day is kept in. */
function istanbulDay(at: Date): string {
  return new Date(at.getTime() + ISTANBUL_OFFSET).toISOString().slice(0, 10);
}

/** Monday 00:00 of the current week, Istanbul time. */
function weekStartIstanbul(now = new Date()): Date {
  const local = new Date(now.getTime() + ISTANBUL_OFFSET);
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - sinceMonday);
  return new Date(monday - ISTANBUL_OFFSET);
}

/**
 * Last 7 days of usage_events, folded into the Özet tab's four boxes. Users
 * and clinics come from the overview already loaded, so the support account
 * stays out here too.
 */
async function getActivity(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  users: AdminUser[],
  clinics: AdminClinic[],
): Promise<AdminActivity> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [recent, first] = await Promise.all([
    supabase
      .from("usage_events")
      .select("user_id, feature, hits, last_at")
      .gte("day", istanbulDay(new Date(now.getTime() - 6 * DAY_MS))),
    supabase.from("usage_events").select("day").order("day").limit(1).maybeSingle(),
  ]);
  if (recent.error) console.error("[admin] failed to read usage_events:", recent.error.message);
  const rows = recent.data ?? [];

  const lastUse = new Map<string, string>();
  const byFeature = new Map<string, { hits: number; users: Set<string> }>();
  for (const r of rows) {
    const userId = r.user_id as string;
    const at = r.last_at as string;
    if ((lastUse.get(userId) ?? "") < at) lastUse.set(userId, at);
    const f = byFeature.get(r.feature as string) ?? { hits: 0, users: new Set<string>() };
    f.hits += r.hits as number;
    f.users.add(userId);
    byFeature.set(r.feature as string, f);
  }

  const clinicOf = new Map<string, string>();
  for (const c of clinics) for (const m of c.members) if (!clinicOf.has(m.userId)) clinicOf.set(m.userId, c.name);

  const person = (u: AdminUser): ActivityUser => {
    const used = lastUse.get(u.id) ?? null;
    const signedIn = u.lastSignInAt;
    return {
      id: u.id,
      email: u.email,
      clinicName: clinicOf.get(u.id) ?? null,
      lastSeenAt: used && signedIn ? (used > signedIn ? used : signedIn) : (used ?? signedIn),
      createdAt: u.createdAt,
    };
  };

  const weekStart = weekStartIstanbul(now);
  const inactive = users
    .map(person)
    .filter((p) => !p.lastSeenAt || new Date(p.lastSeenAt) < weekAgo)
    .sort((a, b) => (a.lastSeenAt ?? "").localeCompare(b.lastSeenAt ?? ""));

  return {
    tracking: Boolean(first.data),
    since: (first.data?.day as string | undefined) ?? null,
    activeUsers: users.filter((u) => lastUse.has(u.id)).length,
    topFeatures: [...byFeature.entries()]
      .map(([id, f]) => ({ label: featureLabel(id), hits: f.hits, users: f.users.size }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3),
    inactive,
    newThisWeek: users.filter((u) => new Date(u.createdAt) >= weekStart).map(person),
  };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = getSupabaseServer();
  if (!supabase) return EMPTY;

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    console.error("[admin] failed to list users:", error.message);
    return { ...EMPTY, connected: true };
  }

  // The support account ("Panelini aç") is not a person — keep it out of every list and count.
  const support = data.users.filter(isSupportUser);
  const users: AdminUser[] = data.users.filter((u) => !isSupportUser(u)).map((u) => ({
    id: u.id,
    email: u.email ?? null,
    fullName: (u.user_metadata?.full_name as string | undefined) ?? null,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    confirmed: Boolean(u.email_confirmed_at),
    // banned_until is a timestamp, and a past one means the ban has lapsed.
    banned: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
  }));
  users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [appointments, demoRequests, feedback, clinics] = await Promise.all([
    countRows(supabase, "appointments"),
    listDemoRequests(supabase),
    listFeedback(supabase),
    listClinics(
      supabase,
      new Map(users.map((u) => [u.id, u.email])),
      new Set(support.map((u) => u.id)),
    ),
  ]);

  const activity = await getActivity(supabase, users, clinics);

  return {
    connected: true,
    supportReady: supportEmail() !== null,
    users,
    demoRequests,
    feedback,
    clinics,
    activity,
    totals: {
      users: users.length,
      newToday: users.filter((u) => new Date(u.createdAt) >= startOfToday).length,
      unconfirmed: users.filter((u) => !u.confirmed).length,
      appointments,
    },
  };
}
