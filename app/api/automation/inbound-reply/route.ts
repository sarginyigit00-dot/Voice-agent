import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isAutomationRequest } from "@/lib/automation/emit";
import { localParts } from "@/lib/automation/format";
import { clinicById } from "@/lib/clinics/server";
import { appointmentFor, cancelAppointment } from "@/lib/appointments/manage";
import { toE164 } from "@/lib/vapi/client";

export const dynamic = "force-dynamic";

/**
 * A patient's WhatsApp reply to a reminder, forwarded by the automation app
 * (automation/app.py, `whatsapp_webhook`) — the app owns the Meta credentials,
 * we own the appointments. Body: { phone, text }. Answers { reply } — the text
 * to send back, or null when the message is none of our business (the line is
 * not a chat: anything but a plain "iptal" gets no answer).
 *
 * Deliberately strict: only the whole message being a cancel phrase counts, so
 * "iptal etmeyin" or "iptal olmasın" can never cancel anything. And only when
 * the number has exactly one upcoming appointment — with several (or in several
 * clinics) we can't tell which one is meant, so the patient is sent to the clinic.
 */
const CANCEL_PHRASES = new Set(["iptal", "iptal et", "iptal edin", "randevumu iptal et", "randevuyu iptal et", "randevumu iptal edin", "cancel"]);

function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  if (!isAutomationRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? toE164(body.phone) : null;
  const text = typeof body?.text === "string" ? normalize(body.text) : "";
  if (!phone) return NextResponse.json({ error: "Geçerli bir telefon gerekli." }, { status: 400 });
  if (!CANCEL_PHRASES.has(text)) return NextResponse.json({ reply: null });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });

  const { data, error } = await supabase
    .from("appointments")
    .select("id, clinic_id")
    .eq("attendee_phone", phone)
    .eq("status", "booked")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(5);

  if (error) {
    console.error("[automation] inbound-reply lookup failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.length) {
    return NextResponse.json({ reply: "Bu numaraya kayıtlı yaklaşan bir randevu bulamadık. Yardım için lütfen kliniği arayın." });
  }
  if (data.length > 1) {
    return NextResponse.json({ reply: "Birden fazla yaklaşan randevunuz görünüyor. İptal için lütfen kliniği arayın." });
  }

  const clinic = await clinicById(data[0].clinic_id);
  const appointment = clinic ? await appointmentFor(clinic, data[0].id) : null;
  if (!clinic || !appointment) {
    return NextResponse.json({ reply: "Randevunuzu şu anda iptal edemedik. Lütfen kliniği arayın." });
  }

  const result = await cancelAppointment(clinic, appointment, "hasta (WhatsApp)");
  if (!result.ok) {
    return NextResponse.json({ reply: "Randevunuzu şu anda iptal edemedik. Lütfen kliniği arayın." });
  }

  const { date, time } = localParts(appointment.starts_at, clinic.timeZone);
  return NextResponse.json({
    reply: `${clinic.name} için ${date}, saat ${time} randevunuz iptal edildi. Yeni randevu için kliniği arayabilirsiniz.`,
  });
}
