"use client";

import { authedFetch } from "@/lib/supabase/authed-fetch";
import type { ClinicUsage } from "@/lib/clinics/usage";

/** This month's minutes against the package, through app/api/clinic/usage. Null on any failure. */
export async function fetchUsage(): Promise<ClinicUsage | null> {
  try {
    const res = await authedFetch("/api/clinic/usage");
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.usage as ClinicUsage | undefined) ?? null;
  } catch {
    return null;
  }
}
