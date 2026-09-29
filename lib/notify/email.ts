import appConfig from "@/app.config";
import { localParts } from "@/lib/automation/format";
import { toE164 } from "@/lib/vapi/client";
import type { ClinicContext } from "@/lib/clinics/server";

/**
 * Email to the clinic, sent straight from this server through Resend — no
 * automation app in between. Two moments call for one:
 *
 * - a call that ended **without an appointment** (someone rang and hung up
 *   unbooked — the clinic may want to call them back), and
 * - a call where the agent **promised a call back** ("klinik sizi arasın"):
 *   the agent says so whenever it can't answer, and until now that promise
 *   reached nobody.
 *
 * Both arrive as one email per call. Best effort, like the rest of the
 * post-call work: 5 s timeout, never throws, and without RESEND_API_KEY it
 * simply doesn't send — the call itself is already logged by then.
 */

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Randevox <bildirim@randevoxai.com>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM?.trim() || DEFAULT_FROM, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`[email] Resend rejected "${subject}": HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.ok;
  } catch (e) {
    console.error("[email] could not reach Resend:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** What the post-call email needs to know about one finished call. */
export interface CallFollowUp {
  startedAt: string;
  agentName: string;
  summary: string;
  /** The line's caller number, when it passed one. */
  callerNumber: string;
  /** Did the caller actually say anything? A silent hang-up is not worth an email. */
  callerSpoke: boolean;
  booked: boolean;
  callback: { requested: boolean; name?: string; phone?: string; reason?: string };
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "+905321234567" → "0532 123 45 67" — how a clinic writes a number down. */
function readableTr(e164: string): string {
  const m = e164.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/**
 * The email for a finished call, or null when none is due: booked with no
 * call back promised, or a silent hang-up. Pure, so it can be tested without
 * sending anything.
 */
export function followUpEmail(clinic: ClinicContext, call: CallFollowUp): { subject: string; html: string; text: string } | null {
  const callback = call.callback.requested;
  const unbooked = !call.booked && call.callerSpoke;
  if (!callback && !unbooked) return null;

  const when = localParts(call.startedAt, clinic.timeZone);
  const phone = toE164(call.callback.phone ?? "") ?? toE164(call.callerNumber);
  const who = call.callback.name?.trim() || (phone ? readableTr(phone) : "Numarası alınamayan bir hasta");

  const subject = callback
    ? `Geri arama bekleyen hasta: ${who}`
    : `Randevusuz arama: ${when.date} ${when.time}`;

  const rows: [string, string][] = [
    ["Zaman", `${when.date}, ${when.time}`],
    ["Karşılayan ajan", call.agentName],
    ["Hasta", call.callback.name?.trim() || "—"],
    ["Telefon", phone ? readableTr(phone) : "Alınamadı"],
    ...(callback ? ([["Aranma sebebi", call.callback.reason?.trim() || "Belirtilmedi"]] as [string, string][]) : []),
    ["Randevu", call.booked ? "Alındı" : "Alınmadı"],
  ];
  const lead = callback
    ? "Ajan bu hastaya kliniğin kendisini geri arayacağını söyledi."
    : "Bu arama randevuyla sonuçlanmadı.";
  const callsUrl = `https://www.${appConfig.domain}/calls`;

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;color:#1f1d2b;max-width:560px">
<p style="margin:0 0 14px">${escape(lead)}</p>
<table style="border-collapse:collapse;width:100%;margin:0 0 16px">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b6880;white-space:nowrap;vertical-align:top">${escape(k)}</td><td style="padding:6px 0;font-weight:600">${escape(v)}</td></tr>`,
    )
    .join("")}</table>
<p style="margin:0 0 6px;color:#6b6880;font-size:13px">Görüşme özeti</p>
<p style="margin:0 0 18px;line-height:1.5">${escape(call.summary || "Özet yok.")}</p>
<p style="margin:0"><a href="${callsUrl}" style="color:#2f6fed">Kaydı ve dökümü panelde aç →</a></p>
<p style="margin:18px 0 0;color:#9a98b0;font-size:12px">${escape(clinic.name)} · Randevox</p>
</div>`;

  const text = [lead, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", `Özet: ${call.summary || "Özet yok."}`, "", callsUrl].join("\n");
  return { subject, html, text };
}

/** Sends the post-call email to the clinic, if one is due and the clinic has an address. */
export async function sendFollowUpEmail(clinic: ClinicContext, call: CallFollowUp): Promise<boolean> {
  if (!clinic.notifyEmail || clinic.status === "suspended") return false;
  const email = followUpEmail(clinic, call);
  if (!email) return false;
  return sendEmail(clinic.notifyEmail, email.subject, email.html, email.text);
}
