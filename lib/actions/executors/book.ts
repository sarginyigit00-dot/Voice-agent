import type { ActionResult, CallActionPayload } from "@/lib/actions/types";
import { calcomConfig, createBooking, speakInstant, toInstant } from "@/lib/calcom/client";
import { findByCall, record } from "@/lib/booking/store";

/**
 * Post-call safety net for booking — **not** the main path.
 *
 * The real booking happens mid-call, in lib/booking/tools.ts, where the agent
 * can check availability and confirm a time to the patient before hanging up.
 * By the time this executor runs the appointment normally already exists, and
 * all it does is say so.
 *
 * It still books in one case: the agent settled on a time (Vapi extracted it
 * into `requestedStart`) but the in-call tool never fired — a dropped tool
 * call, or an assistant configured without the tools. Without a slot it
 * reports the gap instead of firing a request Cal.com will reject.
 *
 * What it deliberately no longer does: fall back to `payload.startedAt`. The
 * call's own start time is always in the past by the time the end-of-call
 * report lands, so every such booking failed — and the failures looked like
 * Cal.com's fault rather than a missing slot.
 */
export async function runBook(payload: CallActionPayload): Promise<ActionResult> {
  const cfg = calcomConfig();
  if (!cfg) {
    const missing = !process.env.CALCOM_API_KEY ? "CALCOM_API_KEY" : "CALCOM_EVENT_TYPE_ID";
    return {
      actionId: "book",
      status: "demo",
      note: `${missing} yok — ${payload.callId} için randevu demo modda kaydedildi.`,
    };
  }

  // Booked live, while the caller was on the line. Nothing to do.
  const existing = await findByCall(payload.callId);
  if (existing) {
    return {
      actionId: "book",
      status: "ok",
      note: `Randevu görüşme sırasında alındı: ${speakInstant(new Date(existing.startsAt), cfg.timeZone)} (#${existing.bookingUid}).`,
    };
  }

  if (!payload.requestedStart) {
    return {
      actionId: "book",
      status: "error",
      note: "Randevu saati görüşmede netleşmedi — takvime yazılmadı. Ajanda check_availability/book_appointment araçlarının tanımlı olduğunu doğrulayın.",
    };
  }

  const start = toInstant(payload.requestedStart, cfg.timeZone);
  if (!start) {
    return {
      actionId: "book",
      status: "error",
      note: `Randevu saati okunamadı ("${payload.requestedStart}") — takvime yazılmadı.`,
    };
  }

  if (start.getTime() <= Date.now()) {
    return {
      actionId: "book",
      status: "error",
      note: `İstenen saat geçmişte (${speakInstant(start, cfg.timeZone)}) — takvime yazılmadı.`,
    };
  }

  const booking = await createBooking(cfg, {
    start,
    name: payload.caller !== "Unknown" ? payload.caller : "Telefonla arayan",
    email: payload.callerEmail ?? null,
    phone: payload.number || null,
    notes: payload.number ? `Telefon: ${payload.number}` : undefined,
    metadata: { callId: payload.callId, agent: payload.agentName, source: "randevox-post-call" },
  });

  if (!booking.ok) {
    return { actionId: "book", status: "error", note: booking.error };
  }

  await record({
    callId: payload.callId,
    bookingUid: booking.data.uid,
    startsAt: start.toISOString(),
    attendeeName: payload.caller,
    attendeeEmail: payload.callerEmail ?? null,
    attendeePhone: payload.number || null,
    agentId: payload.agentId,
    source: "post-call",
  });

  return {
    actionId: "book",
    status: "ok",
    note: `Randevu takvime yazıldı: ${speakInstant(start, cfg.timeZone)} (#${booking.data.uid}).`,
  };
}
