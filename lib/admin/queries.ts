import { getSupabaseServer } from "@/lib/supabase/server";

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
 * A `/on-kayit` sign-up. These are our own prospects who handed us their
 * address directly, so unlike call data we're the controller here — listing
 * and exporting them is ordinary lead handling.
 */
export interface WaitlistEntry {
  id: string;
  email: string;
  createdAt: string;
}

export interface AdminOverview {
  /** False when SUPABASE_SERVICE_ROLE_KEY / URL are missing — panel says so. */
  connected: boolean;
  users: AdminUser[];
  waitlist: WaitlistEntry[];
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
  users: [],
  waitlist: [],
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
 * The `/on-kayit` sign-ups, newest first. RLS has no policies on this table
 * on purpose (supabase/schema.sql), so the service-role client is the only
 * thing that can read it — which is exactly why it belongs here and nowhere
 * in the cockpit.
 */
async function listWaitlist(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase
    .from("waitlist_emails")
    .select("id, email, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[admin] failed to list waitlist_emails:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    createdAt: r.created_at as string,
  }));
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = getSupabaseServer();
  if (!supabase) return EMPTY;

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    console.error("[admin] failed to list users:", error.message);
    return { ...EMPTY, connected: true };
  }

  const users: AdminUser[] = data.users.map((u) => ({
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

  const [appointments, waitlist] = await Promise.all([
    countRows(supabase, "appointments"),
    listWaitlist(supabase),
  ]);

  return {
    connected: true,
    users,
    waitlist,
    totals: {
      users: users.length,
      newToday: users.filter((u) => new Date(u.createdAt) >= startOfToday).length,
      unconfirmed: users.filter((u) => !u.confirmed).length,
      appointments,
    },
  };
}
