import { getSupabaseServer } from "@/lib/supabase/server";

export type WaitlistResult = "ok" | "demo" | "error";

/**
 * Adds an email to the `waitlist_emails` table (supabase/schema.sql) — the
 * store behind the /on-kayit teaser page. Returns "demo" when Supabase isn't
 * configured (the form still shows success so the page works keyless), and
 * treats a duplicate email as success so re-submitting never errors.
 */
export async function addWaitlistEmail(email: string): Promise<WaitlistResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return "demo";

  const { error } = await supabase.from("waitlist_emails").insert({ email });

  if (error) {
    // 23505 = unique_violation — already on the list, that's fine.
    if (error.code === "23505") return "ok";
    console.error("[waitlist] insert failed:", error.message);
    return "error";
  }
  return "ok";
}
