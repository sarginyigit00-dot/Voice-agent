"use client";

/**
 * / — the editorial landing page, aimed at HAIR TRANSPLANT CLINICS.
 *
 * Runs on the scoped `.ed-light` palette (warm paper canvas, soft ink, Signal
 * Blue as the single "on" switch, Ember for accents) — see globals.css. The
 * dark cockpit (`/dashboard` etc.) is untouched.
 *
 * Deliberately NO invented social proof: no client logos, no "trusted by N
 * teams", no made-up conversion stats. The two persuasion sections earn their
 * place instead — a cost calculator driven entirely by the clinic's own
 * numbers, and a call-clock that makes a structural point (you're closed when
 * patients call) without asserting a statistic.
 */

import Link from "next/link";
import { useState } from "react";
import appConfig from "@/app.config";
import { Icon } from "@/components/ui/icon";
import { LogoMark } from "@/components/ui/logo";
import { Waveform } from "@/components/app/waveform";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useLang } from "@/components/i18n/language-provider";
import type { L } from "@/lib/i18n/config";
import { ForceLightRoute } from "./force-light";

/** Thousands separator done by hand — `toLocaleString` risks an SSR/client mismatch. */
function trNumber(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* ═══════════════════════════════════ PAGE ═══════════════════════════════════ */

export default function V2Landing() {
  return (
    <div className="ed-light flex min-h-dvh flex-col">
      <ForceLightRoute />
      <Nav />
      <Hero />
      <CostCalculator />
      <Features />
      <Guardrails />
      <HowItWorks />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════ NAV ════════════════════════════════════ */

function Nav() {
  const { lang } = useLang();
  const links: { label: L; href: string }[] = [
    { label: { tr: "Hesaplayıcı", en: "Calculator" }, href: "#hesap" },
    { label: { tr: "Neler yapar", en: "What it does" }, href: "#features" },
    { label: { tr: "Nasıl kurulur", en: "Setup" }, href: "#how" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="h-6 w-6" />
          <span className="text-[18px] font-semibold tracking-tight">{appConfig.name}</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex h-11 items-center rounded-full px-4 text-[14.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {l.label[lang]}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <LanguageToggle />
          <Link
            href="/login"
            className="hidden h-11 items-center rounded-full px-4 text-[14.5px] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            {lang === "tr" ? "Giriş yap" : "Sign in"}
          </Link>
          <Link href="/signup" className="ed-pill ed-pill-primary h-11 px-5 text-[14.5px]">
            {lang === "tr" ? "Kliniğinizde deneyin" : "Try it in your clinic"}
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════ HERO ═══════════════════════════════════ */

function Hero() {
  const { lang } = useLang();

  // Outcomes, not a spec sheet — no raw latency number, no invented adoption
  // stats. Each cell reads as something the clinic gains or stops losing.
  // The value is bilingual too — "İlk çalışta" and the TR-idiomatic "7/24" were
  // leaking into the English page.
  const specs: { value: L; label: L; accent?: boolean }[] = [
    { value: { tr: "0", en: "0" }, label: { tr: "kaçan hasta araması", en: "patients lost to a missed call" }, accent: true },
    { value: { tr: "7/24", en: "24/7" }, label: { tr: "kesintisiz cevap veren hat", en: "line that always answers" } },
    { value: { tr: "30+", en: "30+" }, label: { tr: "dilde yeni hasta kapısı", en: "languages that open new patients" } },
    { value: { tr: "İlk çalışta", en: "First ring" }, label: { tr: "telefonu açar", en: "answers, on the first ring" } },
  ];

  return (
    // The page's own hero wash plus the waveform motif at poster scale: this
    // hero carries no product shot, so the ground and the type do the work.
    // `isolate` is load-bearing: without its own stacking context the -z-10
    // children escape and paint behind `.ed-light`'s opaque page background,
    // which makes both the wash and the motif invisible.
    <section className="relative isolate overflow-hidden">
      {/* The wash as a -z-10 CHILD (the marketing hero's idiom) — putting the
          background on the section itself would paint over anything behind it.
          A poster-scale waveform was tried here and cut: at 1152px the bars read
          as stray blobs colliding with the stat row, and faint enough not to,
          it earned nothing. The type and the wash carry this hero. */}
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--grad-hero)" }} />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-7 px-5 py-24 text-center lg:py-32">
        {/* Deliberately not "we sell AI" — this is the badge, so it carries the
            outcome (a call that would've been lost, wasn't) rather than the
            mechanism. The product name/category never appears here. */}
        <span className="inline-flex items-center gap-2.5 rounded-full border border-cyan px-4 py-2 text-[13px] text-foreground/80">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan" />
          {lang === "tr" ? "Kaçan arama, kaçan hastadır." : "A missed call is a missed patient."}
        </span>

        <h1 className="font-editorial ed-display max-w-5xl text-pretty">
          {lang === "tr" ? "Randevu için arayan hastayı" : "The patient calling to book"}
          <br />
          <em className="ed-accent">{lang === "tr" ? "bir daha kaçırmayın." : "never reaches voicemail again."}</em>
        </h1>

        <p className="ed-body max-w-2xl text-pretty text-muted-foreground">
          {lang === "tr"
            ? "Randevox kliniğinizin telefonunu ilk çalışta açar: randevu alır, greft ve fiyat sorularını sizin verdiğiniz bilgiyle yanıtlar, yurtdışından arayan hastayla kendi dilinde konuşur. Gece, hafta sonu, siz ameliyattayken bile."
            : "Randevox answers your clinic's phone on the first ring: books appointments, answers graft and pricing questions from the information you provide, and speaks to international patients in their own language. Nights, weekends, even while you're operating."}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className="ed-pill ed-pill-primary px-8 text-[15px]" style={{ height: 52 }}>
            <Icon name="phone" className="h-4 w-4" />
            {lang === "tr" ? "Kliniğinizde deneyin" : "Try it in your clinic"}
          </Link>
        </div>

        {/* Unboxed: four cards were visually heavier than the headline above
            them and inverted the hierarchy. A measured baseline row instead —
            hairlines only from `sm`, where the four sit on one line. */}
        {/* max-w-5xl + tight cell padding so "İlk çalışta" holds one line — the
            four values have to share a baseline for the row to read as a row. */}
        <div className="mt-8 grid w-full max-w-5xl grid-cols-2 gap-y-8 sm:grid-cols-4 sm:gap-y-0">
          {specs.map((s, i) => (
            <div
              key={s.value.en}
              className={`flex flex-col items-center gap-2 px-3 ${i > 0 ? "sm:border-l sm:border-border" : ""}`}
            >
              <span
                className={`font-mono-nums text-[32px] font-medium leading-none tracking-tight ${s.accent ? "text-violet" : ""}`}
              >
                {s.value[lang]}
              </span>
              <span className="ed-eyebrow text-center">{s.label[lang]}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════ MISSED-CALL COST CALCULATOR ══════════════════════
   Replaces the usual "trusted by" logo wall. Every input is the clinic's own
   number, so the result is their arithmetic — nothing is asserted by us. */

function CostCalculator() {
  const { lang } = useLang();
  const [missed, setMissed] = useState(12);
  const [rate, setRate] = useState(20);
  const [value, setValue] = useState(60000);

  const monthlyLoss = missed * 4.33 * (rate / 100) * value;

  const fields: {
    label: L;
    hint: L;
    val: number;
    set: (n: number) => void;
    step: number;
    min: number;
    max: number;
    fmt: (n: number) => string;
  }[] = [
    {
      label: { tr: "Haftada cevapsız kalan arama", en: "Calls missed per week" },
      hint: { tr: "Mesai dışı, meşgul ve hafta sonu dahil", en: "After hours, busy and weekends included" },
      val: missed, set: setMissed, step: 1, min: 0, max: 200,
      fmt: (n) => trNumber(n),
    },
    {
      label: { tr: "Bunların hastaya dönüşme oranı", en: "Share that would become patients" },
      hint: { tr: "Kendi dönüşüm oranınızı girin", en: "Use your own conversion rate" },
      val: rate, set: setRate, step: 1, min: 0, max: 100,
      fmt: (n) => `%${trNumber(n)}`,
    },
    {
      label: { tr: "Ortalama operasyon değeri", en: "Average procedure value" },
      hint: { tr: "Paket fiyatınızın ortalaması", en: "The average of your package prices" },
      val: value, set: setValue, step: 5000, min: 0, max: 500000,
      fmt: (n) => `₺${trNumber(n)}`,
    },
  ];

  return (
    <section id="hesap" className="bg-muted">
      <div className="mx-auto max-w-5xl px-5 py-24 lg:py-28">
        <div className="flex max-w-2xl flex-col gap-3">
          <span className="ed-eyebrow">{lang === "tr" ? "Kendi rakamlarınızla" : "With your own numbers"}</span>
          <h2 className="font-editorial ed-h2 text-pretty">
            {lang === "tr" ? "Cevapsız kalan telefonun " : "What an unanswered phone "}
            <em className="ed-accent">{lang === "tr" ? "aylık maliyeti." : "costs you monthly."}</em>
          </h2>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            {lang === "tr"
              ? "Aşağıdaki üç rakamı siz giriyorsunuz — sonuç sizin aritmetiğiniz, bizim iddiamız değil."
              : "You enter all three numbers below — the result is your arithmetic, not our claim."}
          </p>
        </div>

        <div className="ed-card mt-10 grid overflow-hidden lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-7 p-7 lg:p-8">
            {fields.map((f) => (
              <div key={f.label.en} className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium">{f.label[lang]}</span>
                  <span className="text-[13px] text-muted-foreground">{f.hint[lang]}</span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    aria-label="−"
                    onClick={() => f.set(Math.max(f.min, f.val - f.step))}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-[20px] leading-none text-muted-foreground transition-colors hover:border-violet hover:text-violet"
                  >
                    −
                  </button>
                  <span className="font-mono-nums min-w-[7.5rem] text-center text-[24px] font-medium tracking-tight">
                    {f.fmt(f.val)}
                  </span>
                  <button
                    type="button"
                    aria-label="+"
                    onClick={() => f.set(Math.min(f.max, f.val + f.step))}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-[20px] leading-none text-muted-foreground transition-colors hover:border-violet hover:text-violet"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col justify-center gap-4 border-t border-border bg-muted p-7 lg:border-l lg:border-t-0 lg:p-8">
            <span className="ed-eyebrow">{lang === "tr" ? "Aylık kaçan potansiyel" : "Potential lost monthly"}</span>
            <span className="font-editorial text-[clamp(38px,5vw,56px)] leading-none tracking-tight text-violet">
              ₺{trNumber(monthlyLoss)}
            </span>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {lang === "tr"
                ? "Haftalık kaçan arama × 4,33 hafta × dönüşüm oranınız × ortalama operasyon değeriniz."
                : "Missed calls per week × 4.33 weeks × your conversion rate × your average procedure value."}
            </p>
            <Link href="/signup" className="ed-pill ed-pill-primary mt-2 w-full" style={{ height: 48 }}>
              {lang === "tr" ? "Bu aramaları karşılayın" : "Start answering them"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════════════ FEATURES ═════════════════════════════════ */

function Features() {
  const { lang } = useLang();

  const items: { icon: string; title: L; body: L }[] = [
    {
      icon: "calendar-check",
      title: { tr: "Randevu alır", en: "Books appointments" },
      body: {
        tr: "Takviminize canlı bağlanır, boş saatleri okur, hastaya slot teklif eder ve telefonu kapatmadan randevuyu onaylar.",
        en: "Connects live to your calendar, reads open slots, offers times and confirms before the call ends.",
      },
    },
    {
      icon: "list-checks",
      title: { tr: "Greft ve fiyat sorularını yanıtlar", en: "Answers graft & price questions" },
      body: {
        tr: "Yalnızca sizin verdiğiniz bilgiyle konuşur. Bilmediği bir şeyi uydurmaz — analiz gerektiren soruyu randevuya çevirir.",
        en: "Speaks only from the information you give it. It never invents an answer — it turns those questions into a booking.",
      },
    },
    {
      icon: "languages",
      title: { tr: "Yurtdışı hastayla kendi dilinde", en: "International patients, their language" },
      body: {
        tr: "İngilizce, Arapça, Almanca ve 30+ dil. Hastanın dilini ilk cümleden algılar, konaklama ve transfer sorularını yanıtlar.",
        en: "English, Arabic, German and 30+ more. It detects the language from the first sentence and handles travel questions.",
      },
    },
    {
      icon: "moon",
      title: { tr: "Siz ameliyattayken açık", en: "Open while you're operating" },
      body: {
        tr: "Operasyon, mesai dışı, hafta sonu, tatil — telefon boşta çalmaz. Her arama karşılanır, hiçbiri sesli mesaja düşmez.",
        en: "Surgery, after hours, weekends, holidays — the phone is never left ringing and nothing drops to voicemail.",
      },
    },
    {
      icon: "phone-call",
      title: { tr: "Aynı anda gelen aramaları karşılar", en: "Answers several calls at once" },
      body: {
        tr: "Beş hasta aynı dakikada arasa beşi birden karşılanır. Meşgul sesi yok, bekleme sırası yok, kapatıp giden hasta yok.",
        en: "If five patients call in the same minute, all five are answered. No busy tone, no hold queue, nobody hanging up.",
      },
    },
    {
      icon: "database",
      title: { tr: "Her aramayı kayda geçirir", en: "Logs every call" },
      body: {
        tr: "Özet, tam transkript ve çıkarılan eylem maddeleri hasta kaydına düşer. Kimin ne sorduğunu sonradan okuyabilirsiniz.",
        en: "Summary, full transcript and extracted action items land on the patient record for you to read later.",
      },
    },
  ];

  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-24 lg:py-28">
      <div className="flex max-w-2xl flex-col gap-3">
        <span className="ed-eyebrow">{lang === "tr" ? "Neler yapar" : "What it does"}</span>
        <h2 className="font-editorial ed-h2 text-pretty">
          {lang === "tr" ? "Bir danışma görevlisinin yaptığı her şey, " : "Everything your front desk does, "}
          <em className="ed-accent">{lang === "tr" ? "hiç yorulmadan." : "without tiring."}</em>
        </h2>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
          <div key={f.icon} className="ed-card flex flex-col gap-3.5 p-6">
            <Icon name={f.icon} className="h-6 w-6 text-cyan" />
            <span className="text-[18px] font-medium tracking-tight">{f.title[lang]}</span>
            <span className="text-[15px] leading-relaxed text-muted-foreground">{f.body[lang]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════ GUARDRAILS ══════════════════════════════════
   The second persuasion beat. For a medical vertical the real objection isn't
   "does it work" — it's "will it say something that costs me a lawsuit or a
   refund". So this section is the answer to that, shown as the actual rulebook
   the clinic writes, ending on a scripted refusal. */

function Guardrails() {
  const { lang } = useLang();

  const groups: {
    icon: string;
    tone: string;
    title: L;
    caption: L;
    items: L[];
  }[] = [
    {
      icon: "check",
      tone: "text-violet",
      title: { tr: "Söyleyebilir", en: "It may say" },
      caption: { tr: "Sizin yazdığınız bilgiler", en: "The facts you write" },
      items: [
        { tr: "Kliniğimizde 2.000–4.000 greft aralığı yaygın.", en: "2,000–4,000 grafts is the common range here." },
        { tr: "Saç analizi ücretsiz.", en: "The hair analysis is free." },
        { tr: "Pakete transfer, 4 gece konaklama ve kontrol dahil.", en: "The package covers transfer, 4 nights and the check-up." },
        { tr: "Operasyon yaklaşık 6–8 saat sürüyor.", en: "The procedure takes about 6–8 hours." },
      ],
    },
    {
      icon: "ban",
      tone: "text-cyan",
      title: { tr: "Asla söylemez", en: "It never says" },
      caption: { tr: "Sizi bağlayacak her şey", en: "Anything that binds you" },
      items: [
        { tr: "Kesin fiyat taahhüdü", en: "A firm price commitment" },
        { tr: "Sonuç garantisi", en: "A guarantee of results" },
        { tr: "Teşhis veya ilaç önerisi", en: "A diagnosis or medication advice" },
        { tr: "Doktorun görmediği vaka hakkında yorum", en: "An opinion on a case the doctor hasn't seen" },
      ],
    },
    {
      icon: "corner-up-right",
      tone: "text-foreground",
      title: { tr: "Size devreder", en: "It hands over" },
      caption: { tr: "Anında, bağlamıyla birlikte", en: "Instantly, with the context" },
      items: [
        { tr: "Operasyon sonrası ağrı veya şikâyet", en: "Post-op pain or a complaint" },
        { tr: "İade ve iptal talebi", en: "Refund or cancellation requests" },
        { tr: "Israrla doktorla görüşme isteği", en: "Insisting on speaking to the doctor" },
        { tr: "Basın, iş birliği, tedarikçi", en: "Press, partnerships, suppliers" },
      ],
    },
  ];

  return (
    <section className="border-y border-border bg-muted">
      <div className="mx-auto max-w-6xl px-5 py-24 lg:py-28">
        <div className="flex max-w-2xl flex-col gap-3">
          <span className="ed-eyebrow">{lang === "tr" ? "Kontrol sizde" : "You hold the pen"}</span>
          <h2 className="font-editorial ed-h2 text-pretty">
            {lang === "tr" ? "Ağzından ne çıkacağını " : "What comes out of its mouth "}
            <em className="ed-accent">{lang === "tr" ? "siz yazıyorsunuz." : "is written by you."}</em>
          </h2>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            {lang === "tr"
              ? "Sağlık alanında asıl risk asistanın çalışmaması değil, sizi bağlayacak bir cümle kurması. Randevox yalnızca izin verdiğiniz çerçevede konuşur — dışına çıkması gereken her soruyu randevuya çevirir ya da size devreder."
              : "In healthcare the risk isn't the agent failing — it's the agent saying something that binds you. Randevox speaks only inside the frame you define, and turns anything outside it into a booking or a handover."}
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.title.en} className="ed-card flex flex-col gap-5 p-7">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2.5">
                  <Icon name={g.icon} className={`h-[18px] w-[18px] ${g.tone}`} />
                  <span className="text-[17px] font-medium tracking-tight">{g.title[lang]}</span>
                </span>
                <span className="ed-eyebrow">{g.caption[lang]}</span>
              </div>

              <div className="flex flex-col gap-3">
                {g.items.map((it) => (
                  <span key={it.en} className="flex gap-2.5 text-[14.5px] leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-border" />
                    {it[lang]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* The rulebook in action — a refusal that still ends in a booking. */}
        <div className="ed-card mt-5 flex flex-col gap-5 p-7 lg:p-8">
          <span className="ed-eyebrow">{lang === "tr" ? "Sınırı zorlayan bir soru" : "A question that pushes the line"}</span>

          <div className="flex flex-col gap-4">
            <div className="flex max-w-[85%] flex-col gap-1.5 self-start">
              <span className="ed-eyebrow">{lang === "tr" ? "Hasta" : "Patient"}</span>
              <span className="rounded-[20px] border border-border bg-card px-4 py-3 text-[15px] leading-relaxed">
                {lang === "tr"
                  ? "Bende kesin tutar mı, garanti veriyor musunuz?"
                  : "Will it definitely work for me — do you guarantee it?"}
              </span>
            </div>

            <div className="flex max-w-[85%] flex-col gap-1.5 self-end">
              <span className="ed-eyebrow">{appConfig.name}</span>
              <span className="rounded-[20px] border border-violet bg-violet px-4 py-3 text-[15px] leading-relaxed text-primary-foreground">
                {lang === "tr"
                  ? "Sonuç kişiden kişiye değişiyor, ben garanti veremem. Doktorumuz analizde saç yapınıza bakıp size gerçekçi bir beklenti anlatır — Salı 14:00'e alayım mı?"
                  : "Results vary from person to person, so I can't promise that. Our doctor will look at your hair in the analysis and give you a realistic expectation — shall I book you Tuesday at 14:00?"}
              </span>
            </div>
          </div>

          <p className="max-w-3xl text-[14px] leading-relaxed text-muted-foreground">
            {lang === "tr"
              ? "Garanti vermedi, teşhis koymadı, fiyat taahhüt etmedi — ve hastayı yine de takvime aldı."
              : "No guarantee, no diagnosis, no price commitment — and the patient still ended up on the calendar."}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════ HOW IT WORKS ═══════════════════════════════ */

function HowItWorks() {
  const { lang } = useLang();

  const steps: { n: string; title: L; body: L }[] = [
    {
      n: "01",
      title: { tr: "Numaranızı bağlayın", en: "Connect your number" },
      body: {
        tr: "Mevcut klinik hattınızı yönlendirin ya da yeni bir numara alın. Hastanın bildiği numara değişmez.",
        en: "Forward your existing clinic line or take a new number. The number your patients know stays the same.",
      },
    },
    {
      n: "02",
      title: { tr: "Bilgilerinizi verin", en: "Give it your information" },
      body: {
        tr: "Paketleriniz, greft aralıklarınız, doktor takviminiz ve hangi soruda kime aktaracağı — bir formda anlatırsınız.",
        en: "Your packages, graft ranges, doctor calendar and who to transfer to for what — described once in a form.",
      },
    },
    {
      n: "03",
      title: { tr: "Panelden takip edersiniz", en: "You watch it from the panel" },
      body: {
        tr: "Her aramayı panelden dinler, transkriptini okur, sonucunu görürsünüz.",
        en: "Hear every call in the panel, read the transcript, see the outcome.",
      },
    },
  ];

  return (
    // No time promise in the header — "one afternoon" / "same day" read as
    // unverified speed claims, out of step with the calculator and Guardrails
    // sections, which assert only what's checkable. The steps carry the
    // pitch instead: three, no complex setup, nothing more.
    <section id="how" className="mx-auto max-w-6xl px-5 py-24 lg:py-28">
      <div className="flex max-w-2xl flex-col gap-3">
        <span className="ed-eyebrow">{lang === "tr" ? "Nasıl kurulur" : "Setup" }</span>
        <h2 className="font-editorial ed-h2 text-pretty">
          {lang === "tr" ? "Üç adım, " : "Three steps, "}
          <em className="ed-accent">{lang === "tr" ? "karmaşık kurulum yok." : "no complex setup."}</em>
        </h2>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="ed-card flex flex-col gap-4 p-7">
            <span className="font-mono-nums text-[13px] font-medium text-violet">{s.n}</span>
            <span className="font-editorial ed-h3">{s.title[lang]}</span>
            <span className="text-[15px] leading-relaxed text-muted-foreground">{s.body[lang]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════ FAQ ════════════════════════════════════ */

function Faq() {
  const { lang } = useLang();
  const [open, setOpen] = useState(0);

  const faqs: { q: L; a: L }[] = [
    {
      q: { tr: "Hasta karşısındakinin bot olduğunu anlar mı?", en: "Will patients realise it's a bot?" },
      a: {
        tr: "Çoğu anlamıyor. Düşük gecikmeli akışlı ses, doğal duraklamalar ve araya girme desteği var — hasta sözünü kesebilir, asistan uyum sağlar. Yine de isterseniz açılışta yapay zekâ asistanı olduğunu söyletebilirsiniz — bu tamamen sizin tercihiniz.",
        en: "Most don't. It streams low-latency speech with natural pauses and barge-in, so a patient can interrupt and it adapts. You can still have it disclose that it's an AI assistant in the greeting — that's entirely your call.",
      },
    },
    {
      q: { tr: "Fiyat bilgisini nereden alıyor? Yanlış rakam söyler mi?", en: "Where does pricing come from? Can it quote wrong?" },
      a: {
        tr: "Yalnızca sizin girdiğiniz paket ve greft aralıklarından konuşur. Kapsam dışı bir soru geldiğinde rakam uydurmaz — analiz gerektiğini söyleyip randevuya çevirir veya sizi arar. Neyi söyleyip neyi söylemeyeceğini siz belirlersiniz.",
        en: "Only from the packages and graft ranges you enter. For anything outside that it does not improvise a number — it explains an analysis is needed and turns it into a booking, or escalates to you. You define what it may and may not say.",
      },
    },
    {
      q: { tr: "Yurtdışından arayan hastalarla hangi dillerde konuşuyor?", en: "Which languages does it handle for international patients?" },
      a: {
        tr: "Türkçe, İngilizce, Arapça, Almanca dahil 30+ dil. Hastanın dilini ilk cümlelerden algılar ve aynı dilde devam eder — konaklama, transfer ve paket sorularını da o dilde yanıtlar.",
        en: "30+ languages including Turkish, English, Arabic and German. It detects the language from the first sentences and continues in it — including travel, transfer and package questions.",
      },
    },
    {
      q: { tr: "Mevcut klinik numaramı kullanabilir miyim?", en: "Can I keep my current clinic number?" },
      a: {
        tr: "Evet. Mevcut hattınızı yönlendirmeniz yeterli — hastalarınızın bildiği numara değişmez. İsterseniz sadece mesai dışına, isterseniz meşgulken devreye alırsınız.",
        en: "Yes. Just forward your existing line — the number your patients know stays the same. You can route only after hours, or only when the line is busy.",
      },
    },
    {
      q: { tr: "Randevular takvimimize nasıl düşüyor?", en: "How do bookings reach our calendar?" },
      a: {
        tr: "Kullandığınız takvime (Google Takvim dahil) canlı bağlanır, gerçek uygunluğu okur ve randevuyu telefon kapanmadan yazar. Randevu aynı anda panelinizde de görünür.",
        en: "It connects live to the calendar you already use (Google Calendar included), reads real availability and writes the booking before the call ends. The same booking appears in your panel straight away.",
      },
    },
    {
      q: { tr: "Hasta verileri ne oluyor? KVKK açısından durum nedir?", en: "What happens to patient data?" },
      a: {
        tr: "Kayıtlar ve transkriptler sizin hesabınızda tutulur, dilediğiniz zaman silebilirsiniz. Saklama süresini siz belirlersiniz. Sağlık verisi işlediğiniz için kendi aydınlatma metninizi arama başında okutabilirsiniz.",
        en: "Recordings and transcripts stay in your account and you can delete them at any time. You set the retention period, and you can have your own privacy notice read at the start of the call.",
      },
    },
  ];

  return (
    <section id="faq" className="border-t border-border">
      <div className="mx-auto max-w-3xl px-5 py-24 lg:py-28">
        <div className="flex flex-col gap-3">
          <span className="ed-eyebrow">{lang === "tr" ? "Sık sorulanlar" : "FAQ"}</span>
          <h2 className="font-editorial ed-h2">{lang === "tr" ? "Kliniklerin sorduğu." : "What clinics ask."}</h2>
        </div>

        <div className="mt-10 flex flex-col">
          {faqs.map((f, i) => (
            <button
              key={f.q.en}
              type="button"
              onClick={() => setOpen(open === i ? -1 : i)}
              className="group flex flex-col gap-3 border-t border-border py-6 text-left last:border-b"
            >
              <span className="flex items-center justify-between gap-6">
                <span className="text-[17px] font-medium tracking-tight transition-colors group-hover:text-violet">
                  {f.q[lang]}
                </span>
                <span className="shrink-0 text-[22px] leading-none text-violet">{open === i ? "−" : "+"}</span>
              </span>
              {open === i && (
                <span className="animate-float-up max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                  {f.a[lang]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════════════ FINAL CTA ════════════════════════════════ */

function FinalCta() {
  const { lang } = useLang();

  return (
    <section className="ed-invert relative overflow-hidden">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 px-5 py-24 text-center lg:py-28">
        <Waveform data={[0.4, 0.8, 0.3, 0.9, 0.5, 0.7, 0.35]} width={78} height={38} animated />

        <h2 className="font-editorial ed-h2 text-pretty">
          {lang === "tr" ? "Bir sonraki hasta aradığında " : "When the next patient calls, "}
          <em className="ed-accent">{lang === "tr" ? "biri açsın." : "let someone answer."}</em>
        </h2>

        <p className="ed-body max-w-lg text-muted-foreground">
          {lang === "tr"
            ? "Kliniğinizin numarasını bağlayın, kurulumu tamamlayın. Önce kendi telefonunuzdan test edin."
            : "Connect your clinic's number and complete the setup. Test it from your own phone first."}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className="ed-pill ed-pill-primary px-8 text-[15px]" style={{ height: 52 }}>
            {lang === "tr" ? "Kliniğinizde deneyin" : "Try it in your clinic"}
          </Link>
          <Link href="/demo" className="ed-pill ed-pill-ghost px-7 text-[15px]" style={{ height: 52 }}>
            {lang === "tr" ? "Paneli örnek veriyle gezin" : "Tour the panel with sample data"}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════ FOOTER ═════════════════════════════════ */

function Footer() {
  const { lang } = useLang();

  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-10">
      <div className="flex items-center gap-2.5">
        <LogoMark className="h-5 w-5 opacity-70" />
        <span className="font-mono-nums text-[13px] text-muted-foreground">
          © {new Date().getFullYear()} {appConfig.domain}
        </span>
      </div>
      <div className="flex items-center gap-6">
        {[
          { label: { tr: "Şartlar", en: "Terms" }, href: "/sartlar" },
          { label: { tr: "Gizlilik", en: "Privacy" }, href: "/gizlilik" },
          { label: { tr: "KVKK", en: "Data" }, href: "/gizlilik#kvkk" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="text-[14px] text-muted-foreground transition-colors hover:text-foreground">
            {l.label[lang]}
          </Link>
        ))}
      </div>
    </footer>
  );
}
