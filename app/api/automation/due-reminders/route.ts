import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isAutomationRequest } from "@/lib/automation/emit";
import { localParts } from "@/lib/automation/format";
import { toE164 } from "@/lib/vapi/client";
import { HOUR, REMINDER_WINDOWS, isReminderKind } from "@/lib/automation/reminders";

export const dynamic = "force-dynamic";

/**
 * Which appointments are due a reminder right now — polled by the n8n
 * reminder workflow every 15 minutes, once per kind (windows in
 * lib/automation/reminders.ts). After sending, n8n calls
 * /api/automation/reminders/sent, and the row drops out of this list.
 *
 * Booked less than an hour ago → skipped: the confirmation just went out.
 * Only clinics that are active and have WhatsApp switched on, and only rows
 * with a phone number a message can actually reach.
 */
interface Row {
  id: string;
  starts_at: string;
  attendee_name: string;
  attendee_phone: string | null;
  clinics: { id: string; name: string; time_zone: string } | { id: string; name: string; time_zone: string }[] | null;
}

export async function GET(req: Request) {
  if (!isAutomationRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kind = new URL(req.url).searchParams.get("kind");
  if (!isReminderKind(kind)) {
    return NextResponse.json({ error: "kind=24h veya kind=2h olmalı." }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });

  const w = REMINDER_WINDOWS[kind];
  const now = Date.now();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, attendee_name, attendee_phone, clinics!inner(id, name, time_zone)")
    .eq("status", "booked")
    .is(w.column, null)
    .not("attendee_phone", "is", null)
    .gt("starts_at", new Date(now + w.from).toISOString())
    .lte("starts_at", new Date(now + w.to).toISOString())
    .lte("created_at", new Date(now - HOUR).toISOString())
    .eq("clinics.status", "active")
    .eq("clinics.whatsapp_enabled", true)
    .order("starts_at")
    .limit(100);

  if (error) {
    console.error("[automation] due-reminders query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reminders = ((data ?? []) as Row[]).flatMap((r) => {
    const clinic = Array.isArray(r.clinics) ? r.clinics[0] : r.clinics;
    const phone = r.attendee_phone ? toE164(r.attendee_phone) : null;
    if (!clinic || !phone) return [];
    return [
      {
        id: r.id,
        kind,
        startsAt: r.starts_at,
        ...localParts(r.starts_at, clinic.time_zone),
        attendeeName: r.attendee_name,
        phone,
        clinic: { id: clinic.id, name: clinic.name },
      },
    ];
  });

  return NextResponse.json({ kind, reminders });
}
