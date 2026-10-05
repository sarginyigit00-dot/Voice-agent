"use client";

/**
 * The clinic-call live demo — pulled out of the main landing page so it's
 * not part of the normal marketing flow. Lives at /demo instead; nothing
 * on the public site links to it anymore, but the mechanism is untouched.
 */

import { useEffect, useRef, useState } from "react";
import appConfig from "@/app.config";
import { Icon } from "@/components/ui/icon";
import { Waveform } from "@/components/app/waveform";
import { useLang } from "@/components/i18n/language-provider";
import type { L } from "@/lib/i18n/config";

interface Line {
  who: "agent" | "caller";
  text: L;
}

/**
 * A fact the agent pins down mid-call. The live panel renders these as they
 * land, so the right-hand column has something to say before the call ends —
 * every one of them is traceable to a turn in the transcript beside it.
 */
interface Field {
  label: L;
  value: L;
  /** 1-based turn index at which this becomes known. */
  at: number;
  mono?: boolean;
}

interface DemoAgent {
  tab: L;
  voice: string;
  caller: string;
  outcome: L;
  detail: L;
  turns: Line[];
  fields: Field[];
}

const DEMO_AGENTS: DemoAgent[] = [
  {
    tab: { tr: "Randevu", en: "Appointment" },
    voice: "Defne · sıcak kadın sesi",
    caller: "+90 532 555 0182",
    outcome: { tr: "Randevu oluşturuldu", en: "Appointment booked" },
    detail: { tr: "Salı 14:00 · implant konsültasyonu · onay SMS'i gönderildi", en: "Tue 14:00 · implant consultation · confirmation SMS sent" },
    turns: [
      { who: "agent", text: { tr: "Estetenova Ağız ve Diş Sağlığı Merkezi, ben Defne. Size nasıl yardımcı olabilirim?", en: "Estetenova Dental Clinic, this is Defne. How can I help you?" } },
      { who: "caller", text: { tr: "İmplant düşünüyorum, önce bir görüşme yapabilir miyim?", en: "I'm considering an implant — can I book a consultation first?" } },
      { who: "agent", text: { tr: "Tabii ki. Ücretsiz implant konsültasyonu için Salı 14:00 uygun olur mu?", en: "Of course. Would Tuesday at 14:00 work for a free implant consultation?" } },
      { who: "caller", text: { tr: "Evet, salı olur.", en: "Yes, Tuesday works." } },
      { who: "agent", text: { tr: "Sizi Salı 14:00'e aldım. Elinizde varsa eski bir panoramik filmi WhatsApp'tan gönderirseniz hekimimiz hazırlıklı gelir.", en: "You're booked for Tuesday 14:00. If you have a previous panoramic X-ray, send it on WhatsApp beforehand and our dentist can prepare." } },
    ],
    fields: [
      { label: { tr: "Numara", en: "Number" }, value: { tr: "+90 532 555 0182", en: "+90 532 555 0182" }, at: 1, mono: true },
      { label: { tr: "Talep", en: "Request" }, value: { tr: "İmplant konsültasyonu", en: "Implant consultation" }, at: 2 },
      { label: { tr: "Tarih", en: "Date" }, value: { tr: "Salı 14:00", en: "Tue 14:00" }, at: 3 },
      { label: { tr: "Onay", en: "Confirmed" }, value: { tr: "Hasta onayladı", en: "Patient confirmed" }, at: 4 },
    ],
  },
  {
    tab: { tr: "Fiyat sorusu", en: "Pricing" },
    voice: "Kerem · güven veren erkek sesi",
    caller: "+90 216 555 0143",
    outcome: { tr: "Bilgi verildi · randevuya döndü", en: "Informed · converted to booking" },
    detail: { tr: "Net fiyat verilmedi, muayeneye yönlendirildi · Perşembe 11:00", en: "No firm price given, steered to an exam · Thu 11:00" },
    turns: [
      { who: "agent", text: { tr: "Estetenova Diş, ben Kerem. Buyurun.", en: "Estetenova Dental, this is Kerem. How can I help?" } },
      { who: "caller", text: { tr: "İmplant ne kadar tutuyor?", en: "How much does a dental implant cost?" } },
      { who: "agent", text: { tr: "Fiyat çene yapınıza ve gereken işleme göre değişiyor. Hekim görmeden net rakam vermek doğru olmaz — konsültasyon ücretsiz.", en: "It depends on your jaw and what's needed. Quoting a firm number without the dentist seeing you wouldn't be right — the consultation is free." } },
      { who: "caller", text: { tr: "Anladım, aşağı yukarı bir aralık var mı?", en: "I see — is there a rough range?" } },
      { who: "agent", text: { tr: "Muayenede hekimimiz net planı ve tutarı çıkarır. Perşembe 11:00'e sizi alayım mı?", en: "At the exam our dentist gives you a clear plan and cost. Shall I book you Thursday 11:00?" } },
    ],
    fields: [
      { label: { tr: "Numara", en: "Number" }, value: { tr: "+90 216 555 0143", en: "+90 216 555 0143" }, at: 1, mono: true },
      { label: { tr: "Talep", en: "Request" }, value: { tr: "Fiyat bilgisi", en: "Pricing" }, at: 2 },
      { label: { tr: "Konu", en: "Topic" }, value: { tr: "İmplant fiyatı", en: "Implant pricing" }, at: 3 },
      { label: { tr: "Tarih", en: "Date" }, value: { tr: "Perşembe 11:00", en: "Thu 11:00" }, at: 5 },
    ],
  },
];

const WAVE = [0.4, 0.7, 0.5, 0.9, 0.6, 0.3, 0.8, 0.5, 0.7, 0.4, 0.6, 0.9, 0.5, 0.7, 0.4];

export function LiveDemo() {
  const { t, lang } = useLang();
  const [agent, setAgent] = useState(0);
  const [turn, setTurn] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const active = DEMO_AGENTS[agent];
  const finished = turn >= active.turns.length;

  const stop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => stop, []);

  // Switching agents rewinds the call — handled here, not in an effect, so there
  // is no cascading render on mount.
  const pickAgent = (i: number) => {
    stop();
    setAgent(i);
    setTurn(0);
    setPlaying(false);
  };

  useEffect(() => {
    if (!playing) {
      stop();
      return;
    }
    timer.current = setInterval(() => {
      setTurn((prev) => {
        if (prev >= active.turns.length) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1900);
    return stop;
  }, [playing, active.turns.length]);

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Reveal the first turn the instant the call starts (or replays) instead
    // of waiting for the interval's first 1900ms tick.
    if (finished || turn === 0) setTurn(1);
    setPlaying(true);
  };

  const secs = Math.round(turn * 3.2);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <section id="demo" className="border-y border-border">
      <div className="mx-auto max-w-5xl px-5 py-24 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className="ed-eyebrow">{lang === "tr" ? "Canlı demo" : "Live demo"}</span>
            <h2 className="font-editorial ed-h2">
              {lang === "tr" ? "Kliniğinize gelen bir arama." : "A call to your clinic."}
            </h2>
          </div>
          <div className="flex items-center gap-2.5 pb-1.5">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan" />
            <span className="font-mono-nums text-[12px] text-muted-foreground">
              {lang === "tr" ? "gecikme 612ms" : "latency 612ms"}
            </span>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          {DEMO_AGENTS.map((a, i) => (
            <button
              key={a.tab.en}
              type="button"
              onClick={() => pickAgent(i)}
              className={`inline-flex h-11 items-center rounded-full border px-4 text-[14px] transition-colors ${
                i === agent
                  ? "border-violet bg-violet text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-violet/50 hover:text-foreground"
              }`}
            >
              {t(a.tab)}
            </button>
          ))}
        </div>

        <div className="ed-card mt-5 grid overflow-hidden md:grid-cols-2">
          <div className="flex min-h-[430px] flex-col gap-5 border-b border-border p-7 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                  <Icon name="phone" className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono-nums text-[14px] font-medium">{active.caller}</span>
                  <span className="text-[13px] text-muted-foreground">{active.voice}</span>
                </span>
              </div>
              <span className="font-mono-nums text-[13px] font-medium text-violet">{clock}</span>
            </div>

            <div className="h-px bg-border" />

            {/* `grow` (basis auto), not `flex-1` (basis 0) — the transcript has to
                push the card taller as turns land, not overflow behind it. */}
            <div className="flex grow flex-col gap-3">
              {active.turns.slice(0, turn).map((tn, i) => {
                const isAgent = tn.who === "agent";
                return (
                  <div
                    key={i}
                    className={`animate-float-up flex max-w-[88%] flex-col gap-1.5 ${isAgent ? "self-start" : "self-end"}`}
                  >
                    <span className="ed-eyebrow">{isAgent ? appConfig.name : lang === "tr" ? "Hasta" : "Patient"}</span>
                    <span
                      className={`rounded-[20px] border px-4 py-3 text-[15px] leading-relaxed ${
                        isAgent
                          ? "border-violet bg-violet text-primary-foreground"
                          : "border-border bg-card text-foreground/90"
                      }`}
                    >
                      {t(tn.text)}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={toggle}
              className={`ed-pill self-start px-6 text-[15px] ${playing ? "ed-pill-ghost" : "ed-pill-primary"}`}
              style={{ height: 48 }}
            >
              <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
              {playing
                ? lang === "tr" ? "Duraklat" : "Pause"
                : finished
                  ? lang === "tr" ? "Yeniden dinle" : "Replay"
                  : lang === "tr" ? "Aramayı başlat" : "Start the call"}
            </button>
          </div>

          <div className="flex flex-col gap-5 bg-muted p-7">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="ed-eyebrow">{lang === "tr" ? "Ses dalgası" : "Waveform"}</span>
                {playing && (
                  <span className="ed-eyebrow flex items-center gap-1.5 text-violet">
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-violet" />
                    {lang === "tr" ? "Canlı" : "Live"}
                  </span>
                )}
              </div>
              <Waveform data={WAVE} width={280} height={64} animated playing={playing} className="w-full" />
            </div>

            <div className="h-px bg-border" />

            {/* The call turning into a record, line by line — this is what keeps
                the panel from reading as empty before the outcome lands. */}
            <div className="flex flex-col gap-3.5">
              <span className="ed-eyebrow">{lang === "tr" ? "Şu ana kadar alınanlar" : "Captured so far"}</span>
              <div className="overflow-hidden rounded-[14px] border border-border bg-card">
                {active.fields.map((f, i) => {
                  const known = turn >= f.at;
                  const justLanded = f.at === turn;
                  return (
                    <div
                      key={f.label.en}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""} ${justLanded ? "bg-violet-soft" : ""}`}
                    >
                      <span className="text-[13px] text-muted-foreground">{t(f.label)}</span>
                      {known ? (
                        <span className="flex items-center gap-2">
                          <span
                            className={`text-[14px] ${f.mono ? "font-mono-nums" : ""} ${
                              justLanded ? "font-semibold text-violet" : "font-medium"
                            }`}
                          >
                            {t(f.value)}
                          </span>
                          <Icon
                            name="check"
                            className={`h-3.5 w-3.5 ${justLanded ? "text-violet" : "text-booked"}`}
                          />
                        </span>
                      ) : (
                        <span className="h-[9px] w-[72px] rounded-full border border-dashed border-muted-foreground/40" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="flex flex-col gap-3">
              <span className="ed-eyebrow">{lang === "tr" ? "Arama sonucu" : "Call outcome"}</span>
              {finished ? (
                <div className="animate-float-up flex flex-col gap-3.5">
                  <div className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-card p-4">
                    <span className="flex items-center gap-2">
                      <Icon name="calendar-check" className="h-4 w-4 text-violet" />
                      <span className="text-[14px] font-medium">{t(active.outcome)}</span>
                    </span>
                    <span className="font-mono-nums text-[13px] leading-relaxed text-muted-foreground">
                      {t(active.detail)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { tr: "Hasta kaydı açıldı", en: "Patient record created" },
                      { tr: "Transkript kaydedildi", en: "Transcript saved" },
                      { tr: "WhatsApp gönderildi", en: "WhatsApp sent" },
                    ].map((b, i) => (
                      <span
                        key={b.en}
                        className={`rounded-full border px-3 py-1.5 text-[12px] ${
                          i === 0 ? "border-cyan/60 text-foreground/80" : "border-border text-muted-foreground"
                        }`}
                      >
                        {t(b)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <span className="flex items-center gap-2.5 text-[14px] text-muted-foreground">
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-cyan" />
                  {lang === "tr" ? "Arama sürüyor…" : "Call in progress…"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
