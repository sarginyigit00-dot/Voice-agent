"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";
import { Icon } from "@/components/ui/icon";
import type { L } from "@/lib/i18n/config";
import { TRIAL_DAYS, TRIAL_MAX_CALLS } from "@/lib/demo/trial-limits";
import { LegalShell } from "../legal-shell";

/**
 * /demo-talep — where every "Kliniğinizde deneyin" button lands.
 *
 * Two ways in. "Hemen kendiniz deneyin" (shown only when /api/trial says it
 * can work) opens the clinic's own 14-day web trial and emails the link;
 * "Bizimle görüşün" leaves details for the operator to call back — the request
 * shows up in /admin → Demo talepleri either way. The real line is still set
 * up by us. Same light chrome as the landing page (LegalShell), never the
 * dark cockpit.
 */

const COPY = {
  eyebrow: { tr: "Demo talebi", en: "Request a demo" },
  titleLead: { tr: "Randevox'u", en: "Try Randevox" },
  titleAccent: { tr: "kliniğinizde deneyin.", en: "in your clinic." },
  pitch: {
    tr: "Formu doldurun, size ulaşalım. Kurulumu biz yapıyoruz: numaranızı, takviminizi ve kliniğinizin bilgilerini bağlıyor, ajanı sizin için hazırlıyoruz.",
    en: "Fill in the form and we'll reach out to you. We do the setup: we connect your number, your calendar and your clinic's details, and get the agent ready for you.",
  },
  stepsTitle: { tr: "Sonra ne olacak?", en: "What happens next?" },
  steps: [
    { tr: "Size ulaşıyor, kliniğinizi ve aramalarınızı dinliyoruz.", en: "We reach out and learn about your clinic and its calls." },
    { tr: "Numaranızı ve takviminizi bağlayıp ajanı kuruyoruz.", en: "We connect your number and calendar and set up the agent." },
    { tr: "Yayına almadan önce kendi telefonunuzdan test ediyorsunuz.", en: "You test it from your own phone before it goes live." },
  ] as L[],
  selfPitch: {
    tr: "Formu doldurun, kliniğinizin adıyla konuşan asistanınız birkaç saniyede hazır olsun. Beğenirseniz gerçek hattınızı biz kuruyoruz.",
    en: "Fill in the form and an assistant that speaks in your clinic's name is ready in seconds. If you like it, we set up your real line.",
  },
  selfSteps: [
    { tr: "Formu doldurun; deneme linki e-postanıza gelsin.", en: "Fill in the form; the trial link arrives by email." },
    { tr: "Linki açın, tarayıcınızdan asistanla konuşun.", en: "Open the link and talk to the assistant from your browser." },
    { tr: "Beğenirseniz numaranızı ve takviminizi bağlayıp canlıya alıyoruz.", en: "If you like it, we connect your number and calendar and go live." },
  ] as L[],
  clinicName: { tr: "Klinik adı", en: "Clinic name" },
  contactName: { tr: "Adınız soyadınız", en: "Your full name" },
  phone: { tr: "Telefon", en: "Phone" },
  email: { tr: "E-posta (isteğe bağlı)", en: "Email (optional)" },
  note: { tr: "Not (isteğe bağlı)", en: "Note (optional)" },
  notePlaceholder: {
    tr: "Örn: günde 40-50 arama alıyoruz, akşamları telefon açılmıyor.",
    en: "e.g. we get 40–50 calls a day and nobody answers in the evening.",
  },
  submit: { tr: "Demo talep et", en: "Request a demo" },
  sending: { tr: "Gönderiliyor…", en: "Sending…" },
  consentLead: {
    tr: "Bilgileriniz yalnızca talebinize geri dönüş yapmak için işlenir; ekibimiz sizi telefonla arar. Ayrıntılar:",
    en: "Your details are processed only to get back to you about your request; our team will call you. Details:",
  },
  consentLink: { tr: "Gizlilik Politikası", en: "Privacy Policy" },
  doneTitle: { tr: "Talebiniz alındı.", en: "Your request is in." },
  doneBody: {
    tr: "En kısa sürede verdiğiniz numaradan sizi arayacağız.",
    en: "We'll call you on the number you gave as soon as possible.",
  },
  home: { tr: "Ana sayfaya dön", en: "Back to the homepage" },
  modeSelf: { tr: "Kendiniz deneyin", en: "Try it yourself" },
  modeTalk: { tr: "Bizimle görüşün", en: "Talk to us" },
  selfIntro: {
    tr: `Kliniğinizin adıyla açılan asistanı ${TRIAL_DAYS} gün boyunca tarayıcınızdan deneyin: ${TRIAL_MAX_CALLS} görüşme, numara ya da kurulum gerekmez. Deneme linki e-postanıza gelir.`,
    en: `Try an assistant that answers in your clinic's name, from your browser, for ${TRIAL_DAYS} days: ${TRIAL_MAX_CALLS} calls, no number or setup needed. The trial link arrives by email.`,
  },
  emailRequired: { tr: "E-posta (link buraya gelir)", en: "Email (the link is sent here)" },
  services: { tr: "Hizmetler ve fiyatlar (isteğe bağlı)", en: "Services and prices (optional)" },
  servicesHint: {
    tr: "Her satıra bir hizmet: ad | fiyat TL. Boş bırakırsanız asistan fiyatları muayeneye yönlendirir.",
    en: "One service per line: name | price TL. Leave it empty and the assistant refers price questions to the examination.",
  },
  selfSubmit: { tr: "Deneme linkimi gönder", en: "Send my trial link" },
  creating: { tr: "Asistanınız hazırlanıyor…", en: "Getting your assistant ready…" },
  selfConsent: {
    tr: "Bilgileriniz deneme asistanınızı kurmak, linki e-postanıza göndermek ve denemeniz hakkında sizi aramak için işlenir. Deneme görüşmesi başlamadan önce ayrıca açık rızanız istenir. Ayrıntılar:",
    en: "Your details are processed to set up your trial assistant, email you the link and call you about your trial. Your explicit consent is asked for separately before a trial call starts. Details:",
  },
  selfDoneTitle: { tr: "Linkiniz e-postanızda.", en: "Your link is in your inbox." },
  selfDoneBody: {
    tr: "Deneme linkini e-posta adresinize gönderdik. Birkaç dakika içinde gelmezse gereksiz (spam) klasörüne bakın.",
    en: "We've emailed your trial link. If it doesn't arrive within a few minutes, check your spam folder.",
  },
  resend: { tr: "Mail gelmedi mi? Tekrar gönder", en: "No email? Send it again" },
  resending: { tr: "Gönderiliyor…", en: "Sending…" },
  resent: { tr: "Tekrar gönderdik. Gereksiz (spam) klasörüne de bakın.", en: "Sent again. Check your spam folder too." },
};

const ERRORS: Record<string, L> = {
  clinic_name: { tr: "Klinik adını yazın.", en: "Please enter the clinic name." },
  contact_name: { tr: "Adınızı yazın.", en: "Please enter your name." },
  phone: { tr: "Geçerli bir telefon numarası yazın.", en: "Please enter a valid phone number." },
  email: { tr: "E-posta adresi geçersiz.", en: "That email address isn't valid." },
  failed: { tr: "Gönderilemedi. Lütfen tekrar deneyin.", en: "Couldn't send it. Please try again." },
  email_ascii: { tr: "E-posta adresinde Türkçe karakter (ğ, ş, ı, ö, ü, ç) olamaz.", en: "The email address can't contain Turkish characters (ğ, ş, ı, ö, ü, ç)." },
  email_failed: { tr: "E-posta gönderilemedi. Adresi kontrol edip tekrar deneyin.", en: "We couldn't send the email. Check the address and try again." },
  ip_limit: { tr: "Bu bağlantıdan bugün zaten bir deneme açıldı. Yarın tekrar deneyin ya da bizimle görüşün.", en: "A trial was already opened from this connection today. Try again tomorrow or talk to us." },
  daily_full: { tr: "Bugünkü deneme kontenjanı doldu. Yarın tekrar deneyin ya da bizimle görüşün.", en: "Today's trial slots are full. Try again tomorrow or talk to us." },
  rate_limited: { tr: "Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.", en: "Too many attempts. Please try again a little later." },
  disabled: { tr: "Kendi kendine deneme şu an kapalı. Bizimle görüşün.", en: "Self-serve trials are off right now. Talk to us." },
};

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-violet";

export default function DemoRequestPage() {
  const { lang } = useLang();
  const t = (l: L) => l[lang];

  const [form, setForm] = useState({ clinicName: "", contactName: "", phone: "", email: "", note: "", services: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  // The "send it again" button on the done screen: same request, the server re-sends the existing link.
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle");
  const [resendError, setResendError] = useState<string | null>(null);
  // Self-serve shows only once the server says it can work (calls + email configured).
  const [selfEnabled, setSelfEnabled] = useState(false);
  const [mode, setMode] = useState<"self" | "talk">("talk");

  useEffect(() => {
    fetch("/api/trial")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => {
        if (d.enabled) {
          setSelfEnabled(true);
          setMode("self");
        }
      })
      .catch(() => {});
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const self = mode === "self";

  function switchMode(m: "self" | "talk") {
    setMode(m);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await fetch(self ? "/api/trial" : "/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (body.ok) {
        setState("done");
        return;
      }
      setError(body.error && ERRORS[body.error] ? body.error : "failed");
    } catch {
      setError("failed");
    }
    setState("idle");
  }

  async function resendLink() {
    setResend("sending");
    setResendError(null);
    try {
      const res = await fetch("/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (body.ok) {
        setResend("sent");
        return;
      }
      setResendError(body.error && ERRORS[body.error] ? body.error : "failed");
    } catch {
      setResendError("failed");
    }
    setResend("idle");
  }

  return (
    <LegalShell>
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1fr_minmax(0,460px)] lg:gap-16 lg:py-24">
        <div className="flex flex-col gap-5">
          <span className="ed-eyebrow">{t(COPY.eyebrow)}</span>
          <h1 className="font-editorial ed-h1 max-w-xl text-pretty">
            {t(COPY.titleLead)} <em className="ed-accent">{t(COPY.titleAccent)}</em>
          </h1>
          <p className="ed-body max-w-lg text-pretty text-muted-foreground">{t(self ? COPY.selfPitch : COPY.pitch)}</p>

          <div className="mt-4 max-w-lg">
            <h2 className="text-[15px] font-semibold">{t(COPY.stepsTitle)}</h2>
            <ol className="mt-3 space-y-3">
              {(self ? COPY.selfSteps : COPY.steps).map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground">
                  <span className="font-mono-nums grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-[12px] text-foreground">
                    {i + 1}
                  </span>
                  {t(s)}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="ed-card p-6 sm:p-8">
          {state === "done" ? (
            <div role="status" className="flex flex-col items-start gap-4 py-6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-violet text-primary-foreground">
                <Icon name="check" className="h-5 w-5" />
              </span>
              <h2 className="font-editorial text-[28px] leading-tight">{t(self ? COPY.selfDoneTitle : COPY.doneTitle)}</h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{t(self ? COPY.selfDoneBody : COPY.doneBody)}</p>
              {self &&
                (resend === "sent" ? (
                  <p className="text-[14px] text-muted-foreground">{t(COPY.resent)}</p>
                ) : (
                  <button
                    type="button"
                    onClick={resendLink}
                    disabled={resend === "sending"}
                    className="text-[14.5px] font-medium text-violet underline-offset-4 hover:underline disabled:opacity-60"
                  >
                    {t(resend === "sending" ? COPY.resending : COPY.resend)}
                  </button>
                ))}
              {resendError && (
                <p role="alert" className="rounded-lg bg-missed/10 px-3 py-2 text-[14px] text-missed">
                  {t(ERRORS[resendError])}
                </p>
              )}
              <Link href="/" className="ed-pill ed-pill-ghost mt-2 h-11 px-5 text-[14.5px]">
                {t(COPY.home)}
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              {selfEnabled && (
                <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full border border-border p-1 text-[14px]">
                  {(["self", "talk"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => switchMode(m)}
                      className={`min-h-9 rounded-full px-2 py-1.5 text-[13px] font-medium leading-tight transition-colors sm:text-[13.5px] ${
                        mode === m ? "bg-violet text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t(m === "self" ? COPY.modeSelf : COPY.modeTalk)}
                    </button>
                  ))}
                </div>
              )}
              {self && <p className="text-[14px] leading-relaxed text-muted-foreground">{t(COPY.selfIntro)}</p>}
              <Field label={t(COPY.clinicName)}>
                <input value={form.clinicName} onChange={set("clinicName")} required autoComplete="organization" className={inputClass} />
              </Field>
              <Field label={t(COPY.contactName)}>
                <input value={form.contactName} onChange={set("contactName")} required autoComplete="name" className={inputClass} />
              </Field>
              <Field label={t(COPY.phone)}>
                <input
                  value={form.phone}
                  onChange={set("phone")}
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+90 5xx xxx xx xx"
                  className={inputClass}
                />
              </Field>
              <Field label={t(self ? COPY.emailRequired : COPY.email)}>
                <input value={form.email} onChange={set("email")} type="email" required={self} autoComplete="email" className={inputClass} />
              </Field>
              {self ? (
                <>
                  <Field label={t(COPY.services)}>
                    <textarea
                      value={form.services}
                      onChange={set("services")}
                      rows={4}
                      placeholder={"Diş taşı temizliği | 1500\nİmplant | \nDiş beyazlatma | 3500"}
                      className={`${inputClass} h-auto resize-none py-2.5 leading-relaxed`}
                    />
                    <span className="text-[12.5px] leading-relaxed text-muted-foreground">{t(COPY.servicesHint)}</span>
                  </Field>
                </>
              ) : (
              <Field label={t(COPY.note)}>
                <textarea
                  value={form.note}
                  onChange={set("note")}
                  rows={3}
                  placeholder={t(COPY.notePlaceholder)}
                  className={`${inputClass} h-auto resize-none py-2.5 leading-relaxed`}
                />
              </Field>
              )}

              {/* Honeypot: invisible to people, filled in by form bots. Its name must
                  not look like a real field: browser autofill once filled "website",
                  and the server then silently dropped a real request. */}
              <input
                value={form.website}
                onChange={set("website")}
                name="rx_hp_field"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />

              {error && (
                <p role="alert" className="rounded-lg bg-missed/10 px-3 py-2 text-[14px] text-missed">
                  {t(ERRORS[error])}
                </p>
              )}

              <button
                type="submit"
                disabled={state === "sending"}
                className="ed-pill ed-pill-primary mt-1 w-full text-[15px] disabled:opacity-60"
                style={{ height: 52 }}
              >
                <Icon name={self ? "mail" : "phone"} className="h-4 w-4" />
                {state === "sending" ? t(self ? COPY.creating : COPY.sending) : t(self ? COPY.selfSubmit : COPY.submit)}
              </button>

              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {t(self ? COPY.selfConsent : COPY.consentLead)}{" "}
                <Link href={self ? "/gizlilik#web-demo" : "/gizlilik"} className="underline underline-offset-2 hover:text-foreground">
                  {t(COPY.consentLink)}
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </LegalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13.5px] font-medium">{label}</span>
      {children}
    </label>
  );
}
