"use client";

/**
 * Browser calls with a Randevox assistant — no phone number, mic → WebRTC.
 *
 * - `TryCall`: the landing page's "talk to the agent now" section (#dene),
 *   a fictional clinic, capped at three minutes.
 * - `TryCallCard`: the call itself, also used by a clinic's own 14-day trial
 *   page (/dene/<code>), where `code` picks that clinic's assistant.
 *
 * app/api/try-call holds the master switch and every cap and starts the call
 * itself; the page only joins its room (`reconnect`), so a visitor can't
 * change the assistant. The SDK is loaded only when the visitor presses
 * start, so it costs the page nothing until then. Recorded sample calls
 * (lib/demo/try-call.ts) stand in when a live call can't happen. Never
 * touches /demo or its sample data.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type VapiClient from "@vapi-ai/web";
import { Icon } from "@/components/ui/icon";
import { Waveform } from "@/components/app/waveform";
import { useLang } from "@/components/i18n/language-provider";
import { DEMO_CALL_MAX_SECONDS, SAMPLE_CALLS } from "@/lib/demo/try-call";

type Phase = "idle" | "connecting" | "live" | "ended";
export type Problem =
  | "mic"
  | "rate_limited"
  | "daily_cap"
  | "disabled"
  | "failed"
  | "trial_daily"
  | "expired"
  | "used_up"
  | "not_found"
  | "voice_used_up"
  | null;

interface Line {
  who: "agent" | "caller";
  text: string;
}

const WAVE = [0.35, 0.7, 0.45, 0.9, 0.55, 0.3, 0.8, 0.5, 0.72, 0.38, 0.62, 0.85, 0.48, 0.7, 0.35];

const PROMPTS = [
  { tr: "Yarın için randevu almak istiyorum.", en: "I'd like to book for tomorrow." },
  { tr: "Diş beyazlatma ne kadar?", en: "How much is teeth whitening?" },
  { tr: "Cumartesi açık mısınız?", en: "Are you open on Saturday?" },
];

const PROBLEM_TEXT: Record<Exclude<Problem, null>, { tr: string; en: string }> = {
  mic: { tr: "Mikrofon izni verilmedi. Tarayıcınızın adres çubuğundan izin verip tekrar deneyin.", en: "Microphone access was blocked. Allow it from your browser's address bar and try again." },
  rate_limited: { tr: "Bugünlük deneme hakkınız doldu. Yarın tekrar deneyebilir ya da kliniğiniz için demo isteyebilirsiniz.", en: "You've used today's tries. Come back tomorrow, or request a demo for your clinic." },
  daily_cap: { tr: "Bugünün canlı görüşme kotası doldu.", en: "Today's live-call quota is used up." },
  disabled: { tr: "Canlı görüşme şu an kapalı.", en: "Live calls are off right now." },
  failed: { tr: "Bağlantı kurulamadı. Biraz sonra tekrar deneyin.", en: "Couldn't connect. Please try again shortly." },
  trial_daily: { tr: "Bugünlük deneme aramalarınız doldu. Yarın kaldığınız yerden devam edebilirsiniz.", en: "That's today's trial calls. You can carry on tomorrow." },
  expired: { tr: "Deneme süreniz doldu.", en: "Your trial has ended." },
  used_up: { tr: "Deneme aramalarınızın tamamını kullandınız.", en: "You've used all your trial calls." },
  not_found: { tr: "Bu deneme bulunamadı.", en: "This trial wasn't found." },
  voice_used_up: { tr: "Bu sesle deneme hakkınız doldu. Diğer sesle devam edebilirsiniz.", en: "You've used this voice's trial calls. Carry on with the other voice." },
};

/* ═══════════════════════ landing-page section ═══════════════════════ */

export function TryCall() {
  const { lang } = useLang();
  const tr = lang === "tr";
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);

  /* Is the live call on at all? Off → only the samples show (or nothing). */
  useEffect(() => {
    let alive = true;
    fetch("/api/try-call")
      .then((r) => r.json())
      .then((d: { enabled?: boolean; left?: number | null }) => {
        if (!alive) return;
        setEnabled(Boolean(d.enabled));
        setLeft(typeof d.left === "number" ? d.left : null);
      })
      .catch(() => alive && setEnabled(false));
    return () => {
      alive = false;
    };
  }, []);

  // Nothing to offer: no live call and no recordings yet.
  if (enabled === false && !SAMPLE_CALLS.length) return null;

  return (
    <section id="dene" className="mx-auto w-full max-w-6xl px-5 py-24 lg:py-28">
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-14">
        <div className="flex max-w-xl flex-col gap-4">
          <span className="ed-eyebrow">{tr ? "Kendiniz deneyin" : "Try it yourself"}</span>
          <h2 className="font-editorial ed-h2 text-pretty">
            {tr ? "Ajanla şimdi " : "Talk to the agent "}
            <em className="ed-accent">{tr ? "konuşun." : "right now."}</em>
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {tr
              ? "Kayıt yok, telefon numarası yok. Tarayıcınızın mikrofonuyla örnek bir diş kliniğini arayın; randevu isteyin, fiyat sorun, araya girin. Görüşme en fazla üç dakika sürer."
              : "No sign-up, no phone number. Call a sample dental clinic from your browser's microphone — ask for an appointment, ask about prices, interrupt it. Calls last up to three minutes."}
          </p>
          <TryPrompts />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {tr
              ? "Klinik kurgusaldır ve alınan randevular gerçek değildir. Kendi kliniğinizde ses, senaryo ve fiyatlar size göre ayarlanır."
              : "The clinic is fictional and nothing is really booked. On your own line the voice, script and prices are set up for your clinic."}
          </p>
        </div>

        <div className="flex w-full flex-col gap-4">
          {enabled && !blocked && (
            <TryCallCard
              key={left === null ? "n" : "l"}
              title={tr ? "Örnek Diş Kliniği" : "Sample Dental Clinic"}
              callsLeft={left}
              onProblem={(p) => setBlocked(p === "daily_cap" || p === "disabled")}
            />
          )}
          {blocked && (
            <p role="status" className="ed-card p-4 text-[13px] leading-relaxed text-muted-foreground">
              {tr ? "Bugünün canlı görüşme kotası doldu. " : "Today's live-call quota is used up. "}
              <Link href="/demo-talep" className="font-medium text-violet underline-offset-4 hover:underline">
                {tr ? "Kliniğinize özel deneme isteyin →" : "Request a trial for your clinic →"}
              </Link>
            </p>
          )}
          {SAMPLE_CALLS.length > 0 && <SampleCalls />}
        </div>
      </div>
    </section>
  );
}

export function TryPrompts() {
  const { lang } = useLang();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">{lang === "tr" ? "Şunu söylemeyi deneyin:" : "Try saying:"}</span>
      <ul className="flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <li key={p.en} className="rounded-full border border-border px-3 py-1.5 text-[13px] text-muted-foreground">
            “{p[lang]}”
          </li>
        ))}
      </ul>
    </div>
  );
}

function SampleCalls() {
  const { lang } = useLang();
  const tr = lang === "tr";
  return (
    <div className="ed-card flex flex-col gap-3 p-4">
      <span className="text-[13px] font-medium">{tr ? "Örnek görüşmeleri dinleyin" : "Listen to sample calls"}</span>
      {SAMPLE_CALLS.map((s) => (
        <details key={s.id} className="flex flex-col gap-2 border-t border-border pt-3">
          <summary className="cursor-pointer text-[13px]">{s.title[lang]}</summary>
          <audio controls preload="none" src={s.src} className="mt-2 w-full" />
          <div className="mt-2 flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {s.transcript.map((t, i) => (
              <p key={i}>
                <span className="font-medium text-foreground">
                  {t.who === "agent" ? (tr ? "Asistan" : "Assistant") : tr ? "Arayan" : "Caller"}:
                </span>{" "}
                {t.text}
              </p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

/* ═══════════════════════════ the call ═══════════════════════════ */

export function TryCallCard({
  title,
  code,
  disabled = false,
  onProblem,
  onStarted,
  onEnded,
  callsLeft = null,
  voiceLeft = null,
}: {
  title: string;
  /** A trial: calls left for each voice. The counter then follows the chosen voice. */
  voiceLeft?: { female: number; male: number } | null;
  /** Calls left before this one (today for the demo, in total for a trial); counts down as they call. */
  callsLeft?: number | null;
  /** A call was counted — a trial page re-reads its meters. */
  onStarted?: () => void;
  /** A clinic trial's code; without it, the landing page's demo assistant. */
  code?: string;
  disabled?: boolean;
  onProblem?: (p: Problem) => void;
  /** After a call ends — a trial page re-reads its remaining calls. */
  onEnded?: () => void;
}) {
  const { lang } = useLang();
  const tr = lang === "tr";

  const [phase, setPhase] = useState<Phase>("idle");
  const [problem, setProblem] = useState<Problem>(null);
  const [consent, setConsent] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [left, setLeft] = useState(DEMO_CALL_MAX_SECONDS);
  const [speaking, setSpeaking] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [voice, setVoice] = useState<"female" | "male">("female");
  const [quota, setQuota] = useState<number | null>(voiceLeft ? voiceLeft.female : callsLeft);

  const vapi = useRef<VapiClient | null>(null);
  // Set once we hang up or the call ends: the SDK reports the room closing as
  // an "error", which must not read as a failed call.
  const ending = useRef(false);
  const log = useRef<HTMLDivElement | null>(null);

  /* Countdown while live; Vapi ends the call itself at the cap. */
  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines]);

  /* Leaving the page hangs up — an open call keeps billing. */
  useEffect(() => () => void vapi.current?.stop(), []);

  useEffect(() => setQuota(voiceLeft ? voiceLeft[voice] : callsLeft), [callsLeft, voiceLeft, voice]);

  function fail(p: Exclude<Problem, null>) {
    setProblem(p);
    onProblem?.(p);
    setPhase("idle");
  }

  async function start() {
    setProblem(null);
    setLines([]);
    setLeft(DEMO_CALL_MAX_SECONDS);
    setPhase("connecting");
    ending.current = false;

    // Ask for the mic first: a refusal shouldn't spend one of the day's calls.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      return fail("mic");
    }

    const res = await fetch("/api/try-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website: honeypot, voice, ...(code ? { code } : {}) }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { ok: true; call: { id: string; webCallUrl: string; transport?: { callToken?: string } }; left: number | null }
      | { ok: false; error: Exclude<Problem, null>; left?: number }
      | null;
    if (data && typeof data.left === "number") setQuota(data.left);
    if (!data?.ok) return fail((data && !data.ok && data.error) || "failed");
    onStarted?.();

    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      // The server already created the call; the client only joins its room,
      // so it never needs a key of its own.
      const client = new Vapi("server-created-call");
      vapi.current = client;
      client.on("call-start", () => setPhase("live"));
      client.on("call-end", () => {
        ending.current = true;
        setPhase("ended");
        setSpeaking(false);
        // The webhook counts a trial call a moment after it ends.
        if (onEnded) setTimeout(onEnded, 3000);
      });
      client.on("speech-start", () => setSpeaking(true));
      client.on("speech-end", () => setSpeaking(false));
      client.on("error", (e: unknown) => {
        if (ending.current) return;
        console.warn("[try-call] call error", e);
        ending.current = true;
        setProblem("failed");
        setPhase("ended");
      });
      client.on("message", (m: { type?: string; transcriptType?: string; role?: string; transcript?: string }) => {
        if (m.type !== "transcript" || m.transcriptType !== "final" || !m.transcript?.trim()) return;
        const who = m.role === "assistant" ? "agent" : "caller";
        const text = m.transcript.trim();
        // Consecutive finals from the same side are one turn.
        setLines((prev) => {
          const last = prev[prev.length - 1];
          return last?.who === who ? [...prev.slice(0, -1), { who, text: `${last.text} ${text}` }] : [...prev, { who, text }];
        });
      });
      await client.reconnect(data.call);
    } catch {
      fail("failed");
    }
  }

  function hangUp() {
    ending.current = true;
    void vapi.current?.stop();
    setPhase("ended");
  }

  const live = phase === "live" || phase === "connecting";
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="ed-card overflow-hidden text-left">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex items-center gap-3">
          <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
            {phase === "connecting" && <span className="ping-ring absolute inset-0 rounded-full border border-violet/60" />}
            <Icon name="mic" className="h-4 w-4 text-muted-foreground" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium">{title}</span>
            <span className="text-[12px] text-muted-foreground">{tr ? "web görüşmesi" : "web call"}</span>
          </span>
        </span>
        <span className="flex flex-col items-end gap-0.5">
          <span className="font-mono-nums text-[13px] font-medium text-violet">{clock}</span>
          <span className="ed-eyebrow">
            {phase === "idle"
              ? tr ? "Hazır" : "Ready"
              : phase === "connecting"
                ? tr ? "Bağlanıyor…" : "Connecting…"
                : phase === "live"
                  ? tr ? "Görüşme sürüyor" : "Call in progress"
                  : tr ? "Görüşme bitti" : "Call ended"}
          </span>
        </span>
      </div>

      <div ref={log} className="flex h-[240px] flex-col gap-2.5 overflow-y-auto bg-background px-4 py-3.5" aria-live="polite">
        {!lines.length && (
          <div className="m-auto flex max-w-[260px] flex-col items-center gap-2.5 text-center">
            <Waveform data={WAVE} width={110} height={26} color="var(--color-border)" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {phase === "live"
                ? tr ? "Asistan konuşuyor; söyledikleriniz burada yazıya dökülecek." : "The assistant is speaking; what you say is transcribed here."
                : tr ? "Konuşma metni burada görünecek." : "The transcript appears here."}
            </p>
          </div>
        )}
        {lines.map((line, i) => {
          const isAgent = line.who === "agent";
          return (
            <div key={i} className={`animate-float-up flex max-w-[88%] flex-col gap-1 ${isAgent ? "self-start" : "self-end"}`}>
              <span className="ed-eyebrow">{isAgent ? (tr ? "Asistan" : "Assistant") : tr ? "Siz" : "You"}</span>
              <span
                className={`rounded-[14px] px-3 py-2 text-[13px] leading-relaxed ${
                  isAgent ? "bg-violet text-primary-foreground" : "border border-border bg-card text-foreground/90"
                }`}
              >
                {line.text}
              </span>
            </div>
          );
        })}
      </div>

      {phase === "ended" && !problem && (
        <div className="animate-float-up flex flex-col gap-2 border-t border-border bg-violet-soft px-4 py-3">
          <span className="text-[13px] font-medium">
            {code
              ? tr ? "Gerçek hattınızda hastalarınızı da böyle karşılar." : "On your real line it greets your patients just like this."
              : tr ? "Kendi kliniğinizin hattında görmek ister misiniz?" : "Want to see it on your clinic's own line?"}
          </span>
          <Link href="/demo-talep" className="text-[13px] font-medium text-violet underline-offset-4 hover:underline">
            {code
              ? tr ? "Kendi hattınızda başlatalım →" : "Let's start on your own line →"
              : tr ? "Kliniğinizde 14 gün deneyin →" : "Try it in your clinic for 14 days →"}
          </Link>
        </div>
      )}

      {problem && (
        <div role="alert" className="border-t border-border bg-muted px-4 py-3 text-[13px] leading-relaxed">
          {PROBLEM_TEXT[problem][lang]}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
        {!live && (
          <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-violet)]"
            />
            <span>
              {tr
                ? "Sesimin görüşme süresince yurt dışındaki ses ve yapay zekâ hizmet sağlayıcılarında anlık işlenmesine açık rıza veriyorum. Görüşme kaydedilmez. "
                : "I explicitly consent to my voice being processed in real time by voice and AI providers abroad for the length of the call. The call isn't recorded. "}
              <Link href="/acik-riza" className="underline underline-offset-2">
                {tr ? "Ayrıntılar" : "Details"}
              </Link>
            </span>
          </label>
        )}
        {!live && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="radiogroup" aria-label={tr ? "Asistanın sesi" : "Assistant's voice"} className="flex gap-1 rounded-full border border-border p-0.5 text-[12.5px]">
              {(["female", "male"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={voice === v}
                  onClick={() => setVoice(v)}
                  className={`h-7 cursor-pointer rounded-full px-3 font-medium transition-colors ${
                    voice === v ? "bg-violet text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v === "female" ? (tr ? "Kadın ses" : "Female voice") : tr ? "Erkek ses" : "Male voice"}
                </button>
              ))}
            </div>
            {quota !== null && (
              <span className="font-mono-nums text-[12px] text-muted-foreground">
                {code
                  ? voiceLeft
                    ? tr ? `Bu sesle kalan: ${quota}` : `Left with this voice: ${quota}`
                    : tr ? `Kalan görüşme: ${quota}` : `Calls left: ${quota}`
                  : tr ? `Bugün kalan: ${quota}` : `Left today: ${quota}`}
              </span>
            )}
          </div>
        )}
        {/* Honeypot: hidden from people, filled by bots. */}
        <input
          type="text"
          name="rx_hp_field"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={live ? hangUp : start}
            disabled={!live && (!consent || disabled)}
            className={`ed-pill cursor-pointer px-5 text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50 ${live ? "ed-pill-ghost" : "ed-pill-primary"}`}
            style={{ height: 40 }}
          >
            <Icon name={live ? "phone-off" : "mic"} className="h-4 w-4" />
            {live ? (tr ? "Bitir" : "End call") : phase === "ended" ? (tr ? "Tekrar konuş" : "Talk again") : tr ? "Görüşmeyi başlat" : "Start the call"}
          </button>
          <Waveform
            data={WAVE}
            width={104}
            height={24}
            color={phase === "live" ? "var(--color-violet)" : "var(--color-border)"}
            animated
            playing={phase === "live" && speaking}
          />
        </div>
      </div>
    </div>
  );
}
