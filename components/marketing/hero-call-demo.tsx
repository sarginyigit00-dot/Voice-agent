"use client";

/**
 * HeroCallDemo — the "press ARA and watch a call happen" panel in the landing
 * hero, beside the headline.
 *
 * Runs on the page's own `.ed-light` palette (warm paper, white card, Signal
 * Blue as the single accent) — no dark cockpit surfaces, no second colour
 * system. Deliberately standalone: it doesn't read `lib/demo/data.ts`, never
 * sets the `randevox:demo` flag and never links to /demo — the sample cockpit
 * stays its own surface. This is landing-page copy, nothing more.
 */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Waveform } from "@/components/app/waveform";
import { useLang } from "@/components/i18n/language-provider";
import type { L } from "@/lib/i18n/config";

interface Turn {
  who: "agent" | "caller";
  text: L;
}

interface Scenario {
  tab: L;
  agent: string;
  caller: string;
  outcome: L;
  detail: L;
  turns: Turn[];
}

const SCENARIOS: Scenario[] = [
  {
    tab: { tr: "Randevu", en: "Appointment" },
    agent: "Defne",
    caller: "+90 532 555 0182",
    outcome: { tr: "Randevu oluşturuldu", en: "Appointment booked" },
    detail: { tr: "Salı 14:00 · saç analizi · takvime işlendi", en: "Tue 14:00 · hair analysis · added to your calendar" },
    turns: [
      { who: "agent", text: { tr: "Estetenova Kliniği, ben Defne. Size nasıl yardımcı olabilirim?", en: "Estetenova Clinic, this is Defne. How can I help you?" } },
      { who: "caller", text: { tr: "Merhaba, saç ekimi için bir görüşme almak istiyorum.", en: "Hi — I'd like to book a consultation for a hair transplant." } },
      { who: "agent", text: { tr: "Memnuniyetle. Ücretsiz saç analizi için Salı 14:00 uygun mu?", en: "Happy to help. Would Tuesday at 14:00 work for a free hair analysis?" } },
      { who: "caller", text: { tr: "Evet, salı benim için uygun.", en: "Yes, Tuesday works for me." } },
      { who: "agent", text: { tr: "Sizi Salı 14:00'e aldım, randevunuz takvime işlendi.", en: "You're booked for Tuesday 14:00 — it's on the clinic calendar now." } },
    ],
  },
  {
    tab: { tr: "Fiyat sorusu", en: "Pricing" },
    agent: "Kerem",
    caller: "+90 216 555 0143",
    outcome: { tr: "Bilgi verildi · randevuya döndü", en: "Informed · converted to a booking" },
    detail: { tr: "Greft aralığı paylaşıldı · Perşembe 11:00", en: "Graft range shared · Thu 11:00" },
    turns: [
      { who: "agent", text: { tr: "Estetenova Kliniği, ben Kerem. Buyurun.", en: "Estetenova Clinic, this is Kerem. How can I help?" } },
      { who: "caller", text: { tr: "Saç ekimi ne kadar tutuyor?", en: "How much does a hair transplant cost?" } },
      { who: "agent", text: { tr: "Fiyat greft sayısına göre değişiyor; alan görülmeden net rakam vermek doğru olmaz. Analiz ücretsiz.", en: "It depends on the graft count — quoting a firm number without seeing the area wouldn't be right. The analysis is free." } },
      { who: "caller", text: { tr: "Peki aşağı yukarı bir aralık verebilir misiniz?", en: "Could you give me a rough range at least?" } },
      { who: "agent", text: { tr: "Kliniğimizde 2.000–4.000 greft yaygın. Perşembe 11:00'e analiz için sizi alayım mı?", en: "2,000–4,000 grafts is common here. Shall I book you Thursday 11:00 for the analysis?" } },
    ],
  },
  {
    tab: { tr: "Yurtdışı hasta", en: "International" },
    agent: "Deniz",
    caller: "+44 20 7946 0321",
    outcome: { tr: "Pakete yönlendirildi", en: "Routed to package" },
    detail: { tr: "İngilizce karşılandı · konaklama dahil · Pzt 10:00", en: "Handled in English · stay included · Mon 10:00" },
    turns: [
      { who: "agent", text: { tr: "Estetenova Hair Clinic, this is Deniz. How can I help you today?", en: "Estetenova Hair Clinic, this is Deniz. How can I help you today?" } },
      { who: "caller", text: { tr: "Hi — I'm flying in from London. Do you arrange the hotel as well?", en: "Hi — I'm flying in from London. Do you arrange the hotel as well?" } },
      { who: "agent", text: { tr: "We do. The package covers your transfer, four nights and the aftercare visit.", en: "We do. The package covers your transfer, four nights and the aftercare visit." } },
      { who: "caller", text: { tr: "That sounds good. Could we speak on Monday?", en: "That sounds good. Could we speak on Monday?" } },
      { who: "agent", text: { tr: "Booked for Monday 10:00 — the package details are in your file, our coordinator will go through them with you.", en: "Booked for Monday 10:00 — the package details are in your file, our coordinator will go through them with you." } },
    ],
  },
];

const WAVE = [0.35, 0.7, 0.45, 0.9, 0.55, 0.3, 0.8, 0.5, 0.72, 0.38, 0.62, 0.85, 0.48, 0.7, 0.35];

/** Ring → connect delay, and the pace the transcript streams at. */
const RING_MS = 1400;
const TURN_MS = 2000;

type Phase = "idle" | "ringing" | "live" | "done";

export function HeroCallDemo() {
  const { lang } = useLang();
  const tr = lang === "tr";

  const [pick, setPick] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [turn, setTurn] = useState(0);
  const [secs, setSecs] = useState(0);

  const scenario = SCENARIOS[pick];
  const log = useRef<HTMLDivElement | null>(null);

  /* Ringing → connected. */
  useEffect(() => {
    if (phase !== "ringing") return;
    const id = setTimeout(() => {
      setTurn(1);
      setPhase("live");
    }, RING_MS);
    return () => clearTimeout(id);
  }, [phase]);

  /* The transcript itself: one timeout per turn, so the pace can't drift and
     the end of the script is decided in the effect rather than inside a state
     updater (updaters must stay pure — React may run them more than once). */
  useEffect(() => {
    if (phase !== "live") return;
    if (turn >= scenario.turns.length) {
      const id = setTimeout(() => setPhase("done"), TURN_MS);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setTurn((t) => t + 1), TURN_MS);
    return () => clearTimeout(id);
  }, [phase, turn, scenario.turns.length]);

  /* Call clock. */
  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  /* Keep the newest line in view without scrolling the page itself. */
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turn, phase]);

  /* Switching scenarios rewinds the call. */
  function reset(next: number) {
    setPick(next);
    setPhase("idle");
    setTurn(0);
    setSecs(0);
  }

  function call() {
    if (phase === "ringing" || phase === "live") {
      setPhase("done");
      return;
    }
    setTurn(0);
    setSecs(0);
    setPhase("ringing");
  }

  const busy = phase === "ringing" || phase === "live";
  const finished = phase === "done" && turn >= scenario.turns.length;
  const clock = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  const status = {
    idle: tr ? "Hat hazır" : "Line ready",
    ringing: tr ? "Çalıyor…" : "Ringing…",
    live: tr ? "Görüşme sürüyor" : "Call in progress",
    done: tr ? "Görüşme bitti" : "Call ended",
  }[phase];

  return (
    <div className="flex w-full max-w-[360px] flex-col gap-3">
      {/* Scenario picker */}
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.tab.en}
            type="button"
            onClick={() => reset(i)}
            aria-pressed={i === pick}
            className={`inline-flex h-[30px] cursor-pointer items-center rounded-full border px-3 text-[12.5px] transition-colors ${
              i === pick
                ? "border-violet bg-violet text-primary-foreground"
                : "border-border text-muted-foreground hover:border-violet/50 hover:text-foreground"
            }`}
          >
            {s.tab[lang]}
          </button>
        ))}
      </div>

      <div className="ed-card overflow-hidden text-left">
        {/* Caller strip */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
              {phase === "ringing" && (
                <span className="ping-ring absolute inset-0 rounded-full border border-violet/60" />
              )}
              <Icon name="phone" className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-mono-nums text-[13px] font-medium">{scenario.caller}</span>
              <span className="text-[12px] text-muted-foreground">
                {scenario.agent} · {tr ? "gelen arama" : "incoming call"}
              </span>
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono-nums text-[13px] font-medium text-violet">{clock}</span>
            <span className="ed-eyebrow">{status}</span>
          </div>
        </div>

        {/* Transcript */}
        <div
          ref={log}
          className="flex h-[clamp(200px,27vh,262px)] flex-col gap-2.5 overflow-y-auto bg-background px-4 py-3.5"
          aria-live="polite"
        >
          {phase === "idle" && (
            <div className="m-auto flex max-w-[230px] flex-col items-center gap-2.5 text-center">
              <Waveform data={WAVE} width={110} height={26} color="var(--color-border)" />
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {tr
                  ? "Transkript burada görünecek. Başlatmak için ARA'ya basın."
                  : "The transcript appears here. Press CALL to start."}
              </p>
            </div>
          )}

          {phase === "ringing" && (
            <div className="m-auto flex flex-col items-center gap-2.5">
              <span className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="pulse-dot h-1.5 w-1.5 rounded-full bg-violet"
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </span>
              <p className="text-[13px] text-muted-foreground">{tr ? "Hat bağlanıyor…" : "Connecting…"}</p>
            </div>
          )}

          {scenario.turns.slice(0, turn).map((line, i) => {
            const isAgent = line.who === "agent";
            return (
              <div
                key={i}
                className={`animate-float-up flex max-w-[88%] flex-col gap-1 ${isAgent ? "self-start" : "self-end"}`}
              >
                <span className="ed-eyebrow">
                  {isAgent ? scenario.agent : tr ? "Arayan" : "Caller"}
                </span>
                <span
                  className={`rounded-[14px] px-3 py-2 text-[13px] leading-relaxed ${
                    isAgent
                      ? "bg-violet text-primary-foreground"
                      : "border border-border bg-card text-foreground/90"
                  }`}
                >
                  {line.text[lang]}
                </span>
              </div>
            );
          })}
        </div>

        {/* The outcome sits OUTSIDE the scroller on purpose: inside it, the
            reader had to scroll the transcript back down to see what the call
            actually produced — which is the whole point of the demo. */}
        {finished && (
          <div className="animate-float-up flex flex-col gap-1.5 border-t border-border bg-violet-soft px-4 py-3">
            <span className="flex items-center gap-2">
              <Icon name="calendar-check" className="h-4 w-4 shrink-0 text-violet" />
              <span className="text-[13px] font-medium">{scenario.outcome[lang]}</span>
            </span>
            <span className="font-mono-nums text-[12px] leading-relaxed text-muted-foreground">
              {scenario.detail[lang]}
            </span>
          </div>
        )}

        {/* Dial footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={call}
            className={`ed-pill cursor-pointer px-5 text-[13.5px] ${busy ? "ed-pill-ghost" : "ed-pill-primary"}`}
            style={{ height: 40 }}
          >
            <Icon name={busy ? "phone-off" : "phone-call"} className="h-4 w-4" />
            {busy
              ? tr ? "Kapat" : "Hang up"
              : phase === "done"
                ? tr ? "Tekrar ara" : "Call again"
                : tr ? "Ara" : "Call"}
          </button>
          <Waveform
            data={WAVE}
            width={104}
            height={24}
            color={phase === "live" ? "var(--color-violet)" : "var(--color-border)"}
            animated
            playing={phase === "live"}
          />
        </div>
      </div>

      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        {tr
          ? "Örnek bir görüşme. Kendi hattınızda ses, senaryo ve fiyat bilgisi tamamen sizin kliniğinize göre ayarlanır."
          : "A sample call. On your own line the voice, script and pricing come entirely from your clinic."}
      </p>
    </div>
  );
}
