"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";
import { Icon } from "@/components/ui/icon";
import type { L } from "@/lib/i18n/config";
import { LegalShell } from "../legal-shell";

/**
 * /demo-talep — where every "Kliniğinizde deneyin" button lands.
 *
 * Randevox is sold turnkey, so there is no self-serve sign-up: the clinic
 * leaves its details here, the request shows up in /admin → Demo talepleri,
 * and the operator calls back and sets the line up. Same light chrome as the
 * landing page (LegalShell), never the dark cockpit.
 */

const COPY = {
  eyebrow: { tr: "Demo talebi", en: "Request a demo" },
  titleLead: { tr: "Randevox'u", en: "Try Randevox" },
  titleAccent: { tr: "kliniğinizde deneyin.", en: "in your clinic." },
  pitch: {
    tr: "Formu doldurun, sizi arayalım. Kurulumu biz yapıyoruz: numaranızı, takviminizi ve kliniğinizin bilgilerini bağlıyor, ajanı sizin için hazırlıyoruz.",
    en: "Fill in the form and we'll call you. We do the setup: we connect your number, your calendar and your clinic's details, and get the agent ready for you.",
  },
  stepsTitle: { tr: "Sonra ne olacak?", en: "What happens next?" },
  steps: [
    { tr: "Sizi arıyor, kliniğinizi ve aramalarınızı dinliyoruz.", en: "We call you and learn about your clinic and its calls." },
    { tr: "Numaranızı ve takviminizi bağlayıp ajanı kuruyoruz.", en: "We connect your number and calendar and set up the agent." },
    { tr: "Yayına almadan önce kendi telefonunuzdan test ediyorsunuz.", en: "You test it from your own phone before it goes live." },
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
  consentLead: { tr: "Formu göndererek bilgilerinizin sizinle iletişim kurmak için işlenmesini kabul edersiniz. Ayrıntılar:", en: "By sending this form you agree to your details being used to contact you. Details:" },
  consentLink: { tr: "Gizlilik Politikası", en: "Privacy Policy" },
  doneTitle: { tr: "Talebiniz alındı.", en: "Your request is in." },
  doneBody: {
    tr: "En kısa sürede verdiğiniz numaradan sizi arayacağız.",
    en: "We'll call you on the number you gave as soon as possible.",
  },
  home: { tr: "Ana sayfaya dön", en: "Back to the homepage" },
};

const ERRORS: Record<string, L> = {
  clinic_name: { tr: "Klinik adını yazın.", en: "Please enter the clinic name." },
  contact_name: { tr: "Adınızı yazın.", en: "Please enter your name." },
  phone: { tr: "Geçerli bir telefon numarası yazın.", en: "Please enter a valid phone number." },
  email: { tr: "E-posta adresi geçersiz.", en: "That email address isn't valid." },
  failed: { tr: "Gönderilemedi. Lütfen tekrar deneyin.", en: "Couldn't send it. Please try again." },
};

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-violet";

export default function DemoRequestPage() {
  const { lang } = useLang();
  const t = (l: L) => l[lang];

  const [form, setForm] = useState({ clinicName: "", contactName: "", phone: "", email: "", note: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/demo-request", {
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

  return (
    <LegalShell>
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1fr_minmax(0,460px)] lg:gap-16 lg:py-24">
        <div className="flex flex-col gap-5">
          <span className="ed-eyebrow">{t(COPY.eyebrow)}</span>
          <h1 className="font-editorial ed-h1 max-w-xl text-pretty">
            {t(COPY.titleLead)} <em className="ed-accent">{t(COPY.titleAccent)}</em>
          </h1>
          <p className="ed-body max-w-lg text-pretty text-muted-foreground">{t(COPY.pitch)}</p>

          <div className="mt-4 max-w-lg">
            <h2 className="text-[15px] font-semibold">{t(COPY.stepsTitle)}</h2>
            <ol className="mt-3 space-y-3">
              {COPY.steps.map((s, i) => (
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
              <h2 className="font-editorial text-[28px] leading-tight">{t(COPY.doneTitle)}</h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{t(COPY.doneBody)}</p>
              <Link href="/" className="ed-pill ed-pill-ghost mt-2 h-11 px-5 text-[14.5px]">
                {t(COPY.home)}
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
              <Field label={t(COPY.email)}>
                <input value={form.email} onChange={set("email")} type="email" autoComplete="email" className={inputClass} />
              </Field>
              <Field label={t(COPY.note)}>
                <textarea
                  value={form.note}
                  onChange={set("note")}
                  rows={3}
                  placeholder={t(COPY.notePlaceholder)}
                  className={`${inputClass} h-auto resize-none py-2.5 leading-relaxed`}
                />
              </Field>

              {/* Honeypot: invisible to people, filled in by form bots. */}
              <input
                value={form.website}
                onChange={set("website")}
                name="website"
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
                <Icon name="phone" className="h-4 w-4" />
                {state === "sending" ? t(COPY.sending) : t(COPY.submit)}
              </button>

              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {t(COPY.consentLead)}{" "}
                <Link href="/gizlilik" className="underline underline-offset-2 hover:text-foreground">
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
