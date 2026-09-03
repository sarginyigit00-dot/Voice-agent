"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { authedFetch } from "@/lib/supabase/authed-fetch";

/**
 * Reads the `appointments` table for /randevular. Browser-side, like
 * lib/calls/queries.ts — supabase-js attaches the signed-in user's token and
 * RLS does the rest (see supabase/schema.sql).
 *
 * Writes never happen here: cancelling goes through app/api/appointments/cancel
 * so Cal.com is the one that decides whether the cancellation is real.
 */

export type AppointmentStatus = "booked" | "cancelled";

export interface Appointment {
  id: string;
  callId: string;
  bookingUid: string;
  startsAt: string;
  attendeeName: string;
  attendeeEmail: string | null;
  attendeePhone: string | null;
  agentId: string | null;
  source: "in-call" | "post-call";
  status: AppointmentStatus;
  cancelledAt: string | null;
  createdAt: string;
}

interface AppointmentRowDb {
  id: string;
  call_id: string;
  booking_uid: string;
  starts_at: string;
  attendee_name: string;
  attendee_email: string | null;
  attendee_phone: string | null;
  agent_id: string | null;
  source: "in-call" | "post-call";
  status: AppointmentStatus;
  cancelled_at: string | null;
  created_at: string;
}

function fromRow(r: AppointmentRowDb): Appointment {
  return {
    id: r.id,
    callId: r.call_id,
    bookingUid: r.booking_uid,
    startsAt: r.starts_at,
    attendeeName: r.attendee_name,
    attendeeEmail: r.attendee_email,
    attendeePhone: r.attendee_phone,
    agentId: r.agent_id,
    source: r.source,
    status: r.status ?? "booked",
    cancelledAt: r.cancelled_at,
    createdAt: r.created_at,
  };
}

/**
 * Every appointment, soonest first. Returns null when Supabase isn't
 * configured or the request fails — the page falls back to demo data.
 */
export async function fetchAppointments(limit = 200): Promise<Appointment[] | null> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[appointments] failed to list appointments:", error.message);
    return null;
  }
  return (data as AppointmentRowDb[]).map(fromRow);
}

/**
 * Cancels through our own API route, which cancels on Cal.com first. The
 * signed-in user's access token goes along so the route can verify them —
 * the route holds the service-role key, so it must never trust the caller.
 */
export async function cancelAppointment(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await authedFetch("/api/appointments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: body?.error ?? `İptal başarısız (${res.status}).` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface AvailableSlot {
  start: string;
  spoken: string;
}

/** Real open Cal.com slots for the reschedule picker. */
export async function fetchAvailableSlots(days = 7): Promise<{ ok: boolean; slots: AvailableSlot[]; error?: string }> {
  try {
    const res = await authedFetch(`/api/appointments/available-slots?days=${days}`);
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, slots: [], error: body?.error ?? `İstek başarısız (${res.status}).` };
    return { ok: true, slots: body?.slots ?? [] };
  } catch (e) {
    return { ok: false, slots: [], error: (e as Error).message };
  }
}

/**
 * Reschedules through our own API route, which moves the booking on Cal.com
 * first. Cal.com issues a brand new booking uid for the moved appointment —
 * the caller should refetch (or trust the returned `startsAt`) rather than
 * assume only the time changed.
 */
export async function rescheduleAppointment(
  id: string,
  start: string,
): Promise<{ ok: boolean; startsAt?: string; bookingUid?: string; error?: string }> {
  try {
    const res = await authedFetch("/api/appointments/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, start }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: body?.error ?? `Erteleme başarısız (${res.status}).` };
    return { ok: true, startsAt: body?.startsAt, bookingUid: body?.bookingUid };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
