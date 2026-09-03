"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * `fetch`, but with the signed-in user's Supabase access token attached as a
 * Bearer header — what every API route that holds the service-role key
 * requires (see lib/auth/require-user.ts) before it will touch the database.
 *
 * Without a real session (Supabase unconfigured, or the demo bypass) this
 * still sends the request with no Authorization header; the server route
 * rejects it with 401, which is correct — those routes can trigger real side
 * effects (a Cal.com booking, a CRM read) that a demo session shouldn't reach.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const supabase = getSupabaseBrowser();
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
