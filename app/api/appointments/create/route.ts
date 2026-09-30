import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { calcomConfigFor, createBooking, toInstant } from "@/lib/calcom/client";
import { requireMember } from "@/lib/clinics/server";
import { record } from "@/lib/booking/store";
import { emitEvent } from "@/lib/automation/emit";
import { localParts } from "@/lib/automation/format";
import { toE164 } from "@/lib/vapi/client";

/**
 * Books an appointment by hand from /randevular — for the patient who walks
 * in or writes on WhatsApp. Staff-only, same order as the phone line: Cal.com
 * first, our row second, then the confirmation event. The row's `call_id` is
 * synthetic ("manual-<uuid>"): the column is NOT NULL and uniquely indexed.
 */
export async function POST(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });
  const { user, clinic } = member;

  const cfg = await calcomConfigFor(clinic);
  if (!cfg) return NextResponse.json({ error: "Cal.com yapılandırılmamış." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rawPhone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;
  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined;
  const service = typeof body?.service === "string" && body.service.trim() ? body.service.trim().slice(0, 200) : null;
  const doctor = typeof body?.doctor === "string" && body.doctor.trim() ? body.doctor.trim().slice(0, 200) : null;
  const rawStart = typeof body?.start === "string" ? body.start : null;

  if (!name) return NextResponse.json({ error: "Hasta adı gerekli." }, { status: 400 });
  const phone = toE164(rawPhone);
  if (!phone) return NextResponse.json({ error: "Geçerli bir telefon numarası girin." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-posta adresi geçersiz." }, { status: 400 });
  }
  if (!rawStart) return NextResponse.json({ error: "Randevu saati seçilmedi." }, { status: 400 });

  const start = toInstant(rawStart, cfg.timeZone);
  if (!start) return NextResponse.json({ error: "Randevu saati okunamadı." }, { status: 400 });
  if (start.getTime() <= Date.now()) return NextResponse.json({ error: "Randevu saati geçmişte olamaz." }, { status: 400 });

  const booking = await createBooking(cfg, {
    start,
    name,
    email,
    phone,
    notes: [service ? `Hizmet: ${service}` : null, doctor ? `Doktor: ${doctor}` : null, notes].filter(Boolean).join(" · ") || undefined,
    metadata: { source: "randevox-panel", by: user.email ?? "panel" },
  });
  if (!booking.ok) return NextResponse.json({ error: booking.error }, { status: 502 });

  const id = await record({
    callId: `manual-${randomUUID()}`,
    bookingUid: booking.data.uid,
    startsAt: start.toISOString(),
    attendeeName: name,
    attendeeEmail: email,
    attendeePhone: phone,
    agentId: null,
    clinicId: clinic.id,
    source: "manual",
    service,
    doctor,
  });

  await emitEvent(clinic, "appointment.booked", {
    id,
    startsAt: start.toISOString(),
    ...localParts(start.toISOString(), clinic.timeZone),
    attendeeName: name,
    phone,
    by: user.email ?? "panel",
  });

  return NextResponse.json({ ok: true, id, bookingUid: booking.data.uid, startsAt: start.toISOString() });
}
