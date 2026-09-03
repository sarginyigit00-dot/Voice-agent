"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null = null;

/** True once the two public env vars are set — the app falls back to the demo bypass when they aren't. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Browser Supabase client used for auth (sign in / sign up / session).
 * The session lives in localStorage and is refreshed automatically, so no
 * middleware is needed — every guarded surface is a client component.
 * Returns null in demo mode so callers can degrade instead of throwing.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!cached) {
    cached = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return cached;
}
