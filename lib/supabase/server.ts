import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service role key — bypasses RLS so
 * the Vapi webhook route can write call records without a signed-in user.
 * Returns null when Supabase isn't configured yet (demo mode).
 */
export function getSupabaseServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  if (!cached) {
    cached = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  return cached;
}
