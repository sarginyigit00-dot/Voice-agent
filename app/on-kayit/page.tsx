"use client";

import { useState } from "react";
import appConfig from "@/app.config";
import { useLang } from "@/components/i18n/language-provider";
import { Icon } from "@/components/ui/icon";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { Logo } from "@/components/ui/logo";
import { HOW_STEPS, METRICS, USE_CASES } from "@/lib/demo/data";
import type { L } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * /on-kayit — the niche landing page for Randevox. Hero + proof + features +
 * how it works + use cases + FAQ, closing on the same email capture it opens
 * with. Copy comes from app.config.ts / lib/demo/data.ts so it stays in sync
 * with the rest of the product. Deliberately no pricing.
 */

const COPY = {
  eyebrow: { tr: "Yapay zekâ telefon ajanı", en: "AI phone agent" },
  headlineLead: { tr: "Artık hiçbir müşteri araması", en: "Never let a customer call go" },
  headlineAccent: { tr: "cevapsız kalmasın.", en: "unanswered again." },
  pitch: {
    tr: "Randevox, telefonlara 7/24 gerçek bir insan gibi cevap veren yapay zekâ sesli ajanınız. Aramaları karşılar, randevu alır, uygun olmayanları elemenize gerek kalmadan sizin için nitelendirir. Siz işinize odaklanın, telefonu biz açalım.",
    en: "Randevox is your AI voice agent that answers the phone like a real person, 24/7. It takes calls, books appointments and qualifies leads for you — no manual screening. You focus on your work; we'll pick up the phone.",
  },

  featuresEyebrow: { tr: "Neler yapar", en: "What it does" },
  featuresTitle: { tr: "Bir resepsiyonistin yaptığı her şey, kesintisiz.", en: "Everything a receptionist does — without the gaps." },

  howEyebrow: { tr: "Nasıl çalışır", en: "How it works" },
  howTitle: { tr: "Üç adımda yayında.", en: "Live in three steps." },

  useEyebrow: { tr: "Kullanım alanları", en: "Use cases" },
  useTitle: { tr: "Telefonun çaldığı her yerde.", en: "Wherever the phone rings." },

  faqEyebrow: { tr: "S.S.S.", en: "FAQ" },
  faqTitle: { tr: "Sık sorulan sorular", en: "Frequently asked" },

  ctaTitle: { tr: "Telefonu Randevox açsın.", en: "Let Randevox pick up." },
  ctaBody: {
    tr: "E-postanı bırak, yayına aldığımızda ilk sen dene.",
    en: "Leave your email and be first to try it when we go live.",
  },

  emailPlaceholder: { tr: "E-posta adresiniz", en: "Your email address" },
  cta: { tr: "Haberim olsun", en: "Notify me" },
  ctaLoading: { tr: "Kaydediliyor…", en: "Signing up…" },
  successTitle: { tr: "Listeye eklendiniz!", en: "You're on the list!" },
  successBody: {
    tr: "Randevox yayına çıktığında ilk siz haber alacaksınız.",
    en: "You'll be the first to know when Randevox launches.",
  },
  errorInvalid: { tr: "Geçerli bir e-posta adresi girin.", en: "Enter a valid email address." },
  errorServer: { tr: "Bir şeyler ters gitti — lütfen tekrar deneyin.", en: "Something went wrong — please try again." },
  note: { tr: "Spam yok — sadece lansman duyurusu.", en: "No spam — just the launch announcement." },
  rights: { tr: "Tüm hakları saklıdır.", en: "All rights reserved." },
};

export default function OnKayitPage() {
  const { t } = useLang();
  const m = appConfig.marketing;

  return (
    <main className="min-h-dvh">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-6 pb-24 pt-8"
        style={{ background: "var(--grad-hero)" }}
      >
        <div className="blob left-1/2 top-[-8rem] h-72 w-[34rem] -translate-x-1/2 bg-violet/25" />

        <div className="relative z-10 mx-auto flex max-w-5xl items-center justify-between">
          <Logo />
          <LanguageToggle />
        </div>

        <div className="relative z-10 mx-auto mt-20 flex max-w-xl flex-col items-center text-center">
          <span className="label-mono mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-violet">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-violet" />
            {t(COPY.eyebrow)}
          </span>

          <h1 className="font-display text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl">
            {t(COPY.headlineLead)} <span className="text-violet">{t(COPY.headlineAccent)}</span>
          </h1>

          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            {t(COPY.pitch)}
          </p>

          <WaitlistForm className="mt-10 w-full max-w-md" />

          <p className="mt-6 text-xs text-muted-foreground/70">{t(COPY.note)}</p>
        </div>
      </section>

      {/* ── Metrics strip ───────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-8 px-6 py-10 sm:grid-cols-4">
          {METRICS.map((metric) => (
            <div key={metric.value} className="text-center">
              <p className="font-mono-nums font-display text-2xl font-bold text-foreground">
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t(metric.label)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <Section eyebrow={t(COPY.featuresEyebrow)} title={t(COPY.featuresTitle)}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {m.features.map((f) => (
            <article
              key={f.title.en}
              className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-violet/40"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-soft text-violet">
                <Icon name={f.icon} className="h-4 w-4" />
              </span>
              <h3 className="mt-4 font-display text-[15px] font-semibold">{t(f.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(f.body)}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <Section eyebrow={t(COPY.howEyebrow)} title={t(COPY.howTitle)} bordered>
        <ol className="grid gap-4 sm:grid-cols-3">
          {HOW_STEPS.map((step, i) => (
            <li key={step.title.en} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="label-mono text-violet">0{i + 1}</span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-soft text-violet">
                  <Icon name={step.icon} className="h-4 w-4" />
                </span>
              </div>
              <h3 className="mt-4 font-display text-[15px] font-semibold">{t(step.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(step.body)}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Use cases ───────────────────────────────────────────────────── */}
      <Section eyebrow={t(COPY.useEyebrow)} title={t(COPY.useTitle)} bordered>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((u) => (
            <article key={u.title.en} className="rounded-xl border border-border bg-card p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-soft text-cyan">
                <Icon name={u.icon} className="h-4 w-4" />
              </span>
              <h3 className="mt-4 font-display text-[15px] font-semibold">{t(u.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(u.body)}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <Section eyebrow={t(COPY.faqEyebrow)} title={t(COPY.faqTitle)} bordered narrow>
        <Faq items={m.faq} t={t} />
      </Section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden border-t border-border px-6 py-20"
        style={{ background: "var(--grad-hero)" }}
      >
        <div className="blob left-1/2 top-1/2 h-56 w-[28rem] -translate-x-1/2 -translate-y-1/2 bg-violet/20" />
        <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center text-center">
          <h2 className="font-display text-[30px] font-bold tracking-tight sm:text-[38px]">
            {t(COPY.ctaTitle)}
          </h2>
          <p className="mt-3 text-[15px] text-muted-foreground">{t(COPY.ctaBody)}</p>
          <WaitlistForm className="mt-8 w-full max-w-md" />
          <p className="mt-5 text-xs text-muted-foreground/70">{t(COPY.note)}</p>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <Logo />
          <p>
            © {new Date().getFullYear()} {appConfig.name}. {t(COPY.rights)}
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ══════════════════════════ Section shell ══════════════════════════ */

function Section({
  eyebrow,
  title,
  children,
  bordered,
  narrow,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  bordered?: boolean;
  narrow?: boolean;
}) {
  return (
    <section className={cn("px-6 py-20", bordered && "border-t border-border")}>
      <div className={cn("mx-auto", narrow ? "max-w-3xl" : "max-w-5xl")}>
        <p className="label-mono text-violet">{eyebrow}</p>
        <h2 className="mt-2 max-w-2xl font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[38px]">
          {title}
        </h2>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

/* ══════════════════════════════ FAQ ══════════════════════════════ */

function Faq({ items, t }: { items: { q: L; a: L }[]; t: (v: L) => string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q.en}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm font-medium">{t(item.q)}</span>
              <Icon
                name="chevron-down"
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180 text-violet",
                )}
              />
            </button>
            {isOpen && (
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                {t(item.a)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════ Waitlist email form ════════════════════════ */

function WaitlistForm({ className }: { className?: string }) {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setErrorMsg(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(t(data.error === "invalid_email" ? COPY.errorInvalid : COPY.errorServer));
      }
    } catch {
      setStatus("error");
      setErrorMsg(t(COPY.errorServer));
    }
  }

  return (
    <div className={className}>
      {status === "success" ? (
        <div className="animate-float-up rounded-xl border border-border bg-card px-5 py-4 text-left shadow-soft">
          <p className="font-display text-sm font-semibold text-booked">{t(COPY.successTitle)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t(COPY.successBody)}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t(COPY.emailPlaceholder)}
            className="h-11 flex-1 rounded-lg border border-input bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className={cn(
              "h-11 shrink-0 rounded-lg bg-violet px-5 text-sm font-semibold text-primary-foreground shadow-soft transition-opacity hover:opacity-90",
              status === "loading" && "opacity-60",
            )}
          >
            {status === "loading" ? t(COPY.ctaLoading) : t(COPY.cta)}
          </button>
        </form>
      )}
      {errorMsg && status === "error" && (
        <p className="mt-2 text-left text-xs text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}
