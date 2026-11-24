"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/components/i18n/language-provider";
import { TryCallCard, TryPrompts } from "@/components/marketing/try-call";
import { LegalShell } from "../../legal-shell";
import { TRIAL_CALLS_PER_DAY, TRIAL_CALLS_PER_VOICE } from "@/lib/demo/trial-limits";

/**
 * /dene/<code> — a prospective clinic's own 14-day web trial: its name and
 * facts on a browser-call assistant, no phone number (lib/demo/trials.ts).
 * The link is sent by the operator from /admin → Denemeler and isn't linked
 * from anywhere else; the code is the only key.
 */

interface TrialState {
  found: boolean;
  /** The request itself failed (network, server) — not the same as an unknown code. */
  error?: boolean;
  enabled?: boolean;
  clinicName?: string;
  active?: boolean;
  reason?: "ok" | "expired" | "used_up";
  callsLeft?: number;
  voiceLeft?: { female: number; male: number };
  daysLeft?: number;
  maxCalls?: number;
}

export default function TrialPage() {
  const { code } = useParams<{ code: string }>();
  const { lang } = useLang();
  const tr = lang === "tr";
  const [state, setState] = useState<TrialState | null>(null);

  const load = useCallback(() => {
    fetch(`/api/try-call?code=${encodeURIComponent(code)}`)
      .then(async (r) => {
        if (r.status === 404) return { found: false } as TrialState;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as TrialState;
      })
      .then((d) => setState(d))
      // A failed refresh keeps a trial that already loaded; a failed first load says so, not "not found".
      .catch(() => setState((prev) => (prev?.found ? prev : { found: false, error: true })));
  }, [code]);

  useEffect(load, [load]);

  return (
    <LegalShell>
      <div className="mx-auto max-w-5xl px-5 py-16 lg:py-20">
        {!state ? (
          <p className="text-[14px] text-muted-foreground">{tr ? "Yükleniyor…" : "Loading…"}</p>
        ) : state.error ? (
          <Notice
            title={tr ? "Bağlantı kurulamadı." : "Couldn't connect."}
            body={tr ? "İnternet bağlantınızı kontrol edip tekrar deneyin." : "Check your internet connection and try again."}
            retry={() => {
              setState(null);
              load();
            }}
          />
        ) : !state.found ? (
          <Notice
            title={tr ? "Bu deneme bulunamadı." : "This trial wasn't found."}
            body={tr ? "Linki kontrol edin ya da bizimle iletişime geçin." : "Check the link, or get in touch with us."}
          />
        ) : !state.active ? (
          <Notice
            title={
              state.reason === "expired"
                ? tr ? "Deneme süreniz doldu." : "Your trial has ended."
                : tr ? "Deneme aramalarınızın tamamını kullandınız." : "You've used all your trial calls."
            }
            body={
              tr
                ? `${state.clinicName} için asistanı denediğiniz için teşekkürler. Kendi telefon hattınızda, gerçek takviminizle başlatalım.`
                : `Thanks for trying the assistant for ${state.clinicName}. Let's start it on your own phone line, with your real calendar.`
            }
            cta
          />
        ) : (
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-14">
            <div className="flex max-w-xl flex-col gap-4">
              <span className="ed-eyebrow">{tr ? "Deneme hattınız" : "Your trial line"}</span>
              <h1 className="font-editorial ed-h2 text-pretty">
                {state.clinicName}
                <br />
                <em className="ed-accent">{tr ? "asistanınızla konuşun." : "— talk to your assistant."}</em>
              </h1>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {tr
                  ? "Bu asistan kliniğinizin adıyla açılır; hizmetlerinizi ve fiyatlarınızı bilir. Tarayıcınızın mikrofonuyla arayın, bir hasta gibi konuşun. Ekibinizle de paylaşabilirsiniz."
                  : "This assistant answers in your clinic's name and knows your services and prices. Call it from your browser's microphone and talk like a patient would. Share it with your team too."}
              </p>

              <div className="grid grid-cols-3 gap-3 sm:max-w-md">
                <Meter label={tr ? "Kadın ses" : "Female voice"} value={`${state.voiceLeft?.female ?? 0} / ${TRIAL_CALLS_PER_VOICE}`} />
                <Meter label={tr ? "Erkek ses" : "Male voice"} value={`${state.voiceLeft?.male ?? 0} / ${TRIAL_CALLS_PER_VOICE}`} />
                <Meter label={tr ? "Kalan süre" : "Time left"} value={tr ? `${state.daysLeft} gün` : `${state.daysLeft} days`} />
              </div>

              <TryPrompts />

              <p className="rounded-lg border border-border bg-muted px-3 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {tr
                  ? `Deneme modundasınız: randevular takviminize yazılmaz, saatler örnektir. Kadın sesle ${TRIAL_CALLS_PER_VOICE}, erkek sesle ${TRIAL_CALLS_PER_VOICE} arama hakkınız var; ikisinden toplam en fazla ${TRIAL_CALLS_PER_DAY} tanesini aynı gün kullanabilirsiniz. Bir arama en fazla üç dakika sürer. Her başlatılan görüşme bir hak kullanır.`
                  : `You're in trial mode: nothing is written to your calendar and the times offered are samples. You have ${TRIAL_CALLS_PER_VOICE} calls with the female voice and ${TRIAL_CALLS_PER_VOICE} with the male voice, up to ${TRIAL_CALLS_PER_DAY} in total on the same day. A call lasts up to three minutes. Every call you start uses one call.`}
              </p>
            </div>

            <div className="flex w-full flex-col gap-4">
              <TryCallCard title={state.clinicName ?? ""} code={code} disabled={!state.enabled} callsLeft={state.callsLeft ?? null} voiceLeft={state.voiceLeft ?? null} onStarted={load} onEnded={load} />
              {!state.enabled && (
                <p className="text-[12.5px] text-muted-foreground">
                  {tr ? "Deneme hattı şu an bakımda. Lütfen biraz sonra tekrar deneyin." : "The trial line is under maintenance. Please try again shortly."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </LegalShell>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="ed-card flex flex-col gap-1 px-4 py-3">
      <span className="ed-eyebrow">{label}</span>
      <span className="font-mono-nums text-[22px] font-medium leading-none">{value}</span>
    </div>
  );
}

function Notice({ title, body, cta = false, retry }: { title: string; body: string; cta?: boolean; retry?: () => void }) {
  const { lang } = useLang();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
      <h1 className="font-editorial ed-h2 text-pretty">{title}</h1>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      {retry && (
        <button type="button" onClick={retry} className="ed-pill ed-pill-primary cursor-pointer px-7 text-[15px]" style={{ height: 48 }}>
          {lang === "tr" ? "Tekrar dene" : "Try again"}
        </button>
      )}
      {cta && (
        <Link href="/demo-talep" className="ed-pill ed-pill-primary px-7 text-[15px]" style={{ height: 48 }}>
          {lang === "tr" ? "Kendi hattımda başlat" : "Start on my own line"}
        </Link>
      )}
    </div>
  );
}
