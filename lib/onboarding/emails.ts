import { after } from "next/server";
import appConfig from "@/app.config";
import { isEmailConfigured, sendEmail } from "@/lib/notify/email";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Onboarding emails to a clinic, sent through Resend like the rest of the
 * mail (lib/notify/email.ts). The wording lives here (it was moved over from
 * the old Brevo templates 1–4):
 *
 *  · welcome — the operator marks the clinic "Aktif" in /admin (payment came in)
 *  · ready   — the operator runs "Numaraya bağla": the line answers, setup is done
 *  · day3    — 3 days after `ready`: look through the call log
 *  · day7    — 7 days after `ready`: a tip (fill in /klinik) and a question
 *
 * Every mail asks the clinic to "just reply", so replies go to the support
 * inbox (REPLY_TO), not to the no-reply sender.
 *
 * day3/day7 are sent by /api/automation/onboarding, polled daily by the
 * automation app. Each kind goes to a clinic at most once: the row in
 * `onboarding_emails` is claimed before sending and released if the send fails.
 * Best effort like the other mail here — never throws, and without
 * RESEND_API_KEY it simply doesn't send.
 */

export type OnboardingKind = "welcome" | "ready" | "day3" | "day7";

const DAY = 24 * 60 * 60 * 1000;
const REPLY_TO = `destek@${appConfig.domain}`;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface OnboardingCopy {
  subject: string;
  paragraphs: string[];
  link?: { path: string; label: string };
  /** A paragraph after the link. */
  after?: string;
}

const COPY: Record<OnboardingKind, OnboardingCopy> = {
  welcome: {
    subject: "Randevox'a hoş geldiniz",
    paragraphs: [
      "Randevox'u tercih ettiğiniz için teşekkür ederiz. Kliniğinizin sesli asistanını şu an sizin için hazırlıyoruz. Kurulum en geç 1 hafta içinde tamamlanır; hazır olduğunda size ayrıca haber vereceğiz.",
      "Bu süre içinde sizin bir şey yapmanıza gerek yok. Bir sorunuz olursa bu maile cevap vermeniz yeterli.",
    ],
  },
  ready: {
    subject: "Asistanınız hazır: kendi numaranızı arayıp deneyin",
    paragraphs: [
      "Kurulum tamamlandı: sesli asistanınız artık kliniğinizin telefonunu açıyor.",
      "İlk iş olarak kendi numaranızı arayıp bir randevu almayı deneyin. 2 dakika sürer; aldığınız randevu panelinizde hemen görünür.",
    ],
    link: { path: "/randevular", label: "Randevuları panelde aç →" },
    after: "Bir şey beklediğiniz gibi gitmezse bu maile cevap vermeniz yeterli.",
  },
  day3: {
    subject: "Asistanınız aramaları nasıl karşılıyor?",
    paragraphs: [
      "Asistanınız birkaç gündür telefonlarınızı açıyor. Arama kayıtlarına göz atmanızı öneririz: her aramanın özetini, konuşmanın tamamını ve sonucunu (randevu, geri arama, aktarma) tek ekranda görebilirsiniz.",
    ],
    link: { path: "/calls", label: "Aramaları panelde aç →" },
    after: "Asistanın bir soruya yanlış ya da eksik cevap verdiğini görürseniz bu maile yazın, birlikte düzeltelim.",
  },
  day7: {
    subject: "Bir ipucu ve bir sorumuz var",
    paragraphs: [
      "Asistanınız bir haftadır sizinle. Bir ipucu: panelde Klinik bilgileri sayfasına hizmetlerinizi, fiyatlarınızı ve sık sorulan soruları eklerseniz asistan hastalara çok daha net cevap verir.",
    ],
    link: { path: "/klinik", label: "Klinik bilgilerini aç →" },
    after: "Bir de sorumuz var: Randevox'un en çok hangi kısmı işinize yaradı? Bu maile kısa bir cevap bile bizim için çok değerli.",
  },
};

/** The email for one kind, addressed to one clinic. Pure, so it can be tested without sending. */
export function onboardingEmail(kind: OnboardingKind, clinicName: string): { subject: string; html: string; text: string } {
  const copy = COPY[kind];
  const greeting = `Merhaba ${clinicName} ekibi,`;
  const href = copy.link ? `https://www.${appConfig.domain}${copy.link.path}` : null;
  const p = (s: string) => `<p style="margin:0 0 14px">${escape(s)}</p>`;

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1f1d2b;max-width:560px">
${p(greeting)}
${copy.paragraphs.map(p).join("\n")}
${href && copy.link ? `<p style="margin:0 0 14px"><a href="${href}" style="color:#2f6fed;font-weight:600">${escape(copy.link.label)}</a></p>` : ""}
${copy.after ? p(copy.after) : ""}
<p style="margin:0">Randevox Ekibi</p>
</div>`;

  const text = [
    greeting,
    "",
    ...copy.paragraphs.flatMap((s) => [s, ""]),
    ...(href && copy.link ? [`${copy.link.label.replace(" →", "")}: ${href}`, ""] : []),
    ...(copy.after ? [copy.after, ""] : []),
    "Randevox Ekibi",
  ].join("\n");

  return { subject: copy.subject, html, text };
}

async function sendKind(to: string, kind: OnboardingKind, clinicName: string): Promise<boolean> {
  const mail = onboardingEmail(kind, clinicName);
  return sendEmail(to, mail.subject, mail.html, mail.text, REPLY_TO);
}

/** Sends one onboarding email unless this clinic already got it. True when it went out now. */
export async function sendOnboardingEmail(clinicId: string, kind: OnboardingKind): Promise<boolean> {
  const supabase = getSupabaseServer();
  if (!supabase || !isEmailConfigured()) return false;

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, notify_email")
    .eq("id", clinicId)
    .maybeSingle();
  const to = String(clinic?.notify_email ?? "").trim();
  if (!clinic || !to) return false;

  // Claim first: a second save or a parallel poll finds the row and stops here.
  const { data: claimed, error } = await supabase
    .from("onboarding_emails")
    .upsert({ clinic_id: clinicId, kind }, { onConflict: "clinic_id,kind", ignoreDuplicates: true })
    .select("clinic_id");
  if (error || !claimed?.length) return false;

  if (await sendKind(to, kind, clinic.name)) return true;
  await supabase.from("onboarding_emails").delete().eq("clinic_id", clinicId).eq("kind", kind);
  return false;
}

/** Sends after the response inside a request (the admin panel never waits on the mail server), straight away otherwise. */
export function queueOnboardingEmail(clinicId: string, kind: OnboardingKind): void {
  const run = () => sendOnboardingEmail(clinicId, kind).catch((e) => console.error(`[onboarding] ${kind} failed:`, e));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** The day-3 and day-7 emails that are due, counted from each clinic's `ready` email. */
export async function sendDueOnboardingEmails(now = new Date()): Promise<Record<"day3" | "day7", number>> {
  const sent = { day3: 0, day7: 0 };
  const supabase = getSupabaseServer();
  if (!supabase) return sent;

  const { data: rows, error } = await supabase.from("onboarding_emails").select("clinic_id, kind, sent_at");
  if (error || !rows) return sent;

  const readyAt = new Map<string, number>();
  const done = new Set<string>();
  for (const r of rows) {
    if (r.kind === "ready") readyAt.set(r.clinic_id, Date.parse(r.sent_at));
    done.add(`${r.clinic_id}:${r.kind}`);
  }

  // A clinic that stopped paying gets no more "how is it going" mail.
  const { data: active } = await supabase
    .from("clinics")
    .select("id")
    .in("id", [...readyAt.keys()])
    .eq("billing_status", "active");
  const activeIds = new Set((active ?? []).map((c) => c.id as string));

  for (const [clinicId, at] of readyAt) {
    if (!activeIds.has(clinicId)) continue;
    for (const [kind, days] of [["day3", 3], ["day7", 7]] as const) {
      if (done.has(`${clinicId}:${kind}`) || now.getTime() - at < days * DAY) continue;
      if (await sendOnboardingEmail(clinicId, kind)) sent[kind]++;
    }
  }
  return sent;
}
