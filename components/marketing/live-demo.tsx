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
    detail: { tr: "Salı 14:00 · saç analizi · onay SMS'i gönderildi", en: "Tue 14:00 · hair analysis · confirmation SMS sent" },
    turns: [
      { who: "agent", text: { tr: "Estetenova Saç Ekim Merkezi, ben Defne. Size nasıl yardımcı olabilirim?", en: "Estetenova Hair Clinic, this is Defne. How can I help you?" } },
      { who: "caller", text: { tr: "Saç ekimi düşünüyorum, önce bir görüşme yapabilir miyim?", en: "I'm considering a transplant — can I book a consultation first?" } },
      { who: "agent", text: { tr: "Tabii ki. Ücretsiz saç analizi için Salı 14:00 uygun olur mu?", en: "Of course. Would Tuesday at 14:00 work for a free hair analysis?" } },
      { who: "caller", text: { tr: "Evet, salı olur.", en: "Yes, Tuesday works." } },
      { who: "agent", text: { tr: "Sizi Salı 14:00'e aldım. Öncesinde tepe bölgenizin bir fotoğrafını WhatsApp'tan gönderirseniz doktorumuz hazırlıklı gelir.", en: "You're booked for Tuesday 14:00. If you send a photo of your crown on WhatsApp beforehand, our doctor can prepare." } },
    ],
    fields: [
      { label: { tr: "Numara", en: "Number" }, value: { tr: "+90 532 555 0182", en: "+90 532 555 0182" }, at: 1, mono: true },
      { label: { tr: "Talep", en: "Request" }, value: { tr: "Saç analizi", en: "Hair analysis" }, at: 2 },
      { label: { tr: "Tarih", en: "Date" }, value: { tr: "Salı 14:00", en: "Tue 14:00" }, at: 3 },
      { label: { tr: "Onay", en: "Confirmed" }, value: { tr: "Hasta onayladı", en: "Patient confirmed" }, at: 4 },
    ],
  },
  {
    tab: { tr: "Fiyat & greft", en: "Price & grafts" },
    voice: "Kerem · güven veren erkek sesi",
    caller: "+90 216 555 0143",
    outcome: { tr: "Bilgi verildi · randevuya döndü", en: "Informed · converted to booking" },
    detail: { tr: "Greft aralığı paylaşıldı · Perşembe 11:00", en: "Graft range shared · Thu 11:00" },
    turns: [
      { who: "agent", text: { tr: "Estetenova, ben Kerem. Buyurun.", en: "Estetenova, this is Kerem. How can I help?" } },
      { who: "caller", text: { tr: "Saç ekimi ne kadar tutuyor?", en: "How much does a hair transplant cost?" } },
      { who: "agent", text: { tr: "Fiyat greft sayısına göre değişiyor. Ekilecek alan görülmeden net rakam vermek doğru olmaz — analiz ücretsiz.", en: "It depends on the graft count. Quoting a firm number without seeing the area wouldn't be right — the analysis is free." } },
      { who: "caller", text: { tr: "Anladım, aşağı yukarı bir aralık var mı?", en: "I see — is there a rough range?" } },
      { who: "agent", text: { tr: "Kliniğimizde 2.000–4.000 greft aralığı yaygın. Perşembe 11:00'e analiz için sizi alayım mı?", en: "2,000–4,000 grafts is the common range here. Shall I book you Thursday 11:00 for the analysis?" } },
    ],
    fields: [
      { label: { tr: "Numara", en: "Number" }, value: { tr: "+90 216 555 0143", en: "+90 216 555 0143" }, at: 1, mono: true },
      { label: { tr: "Talep", en: "Request" }, value: { tr: "Fiyat bilgisi", en: "Pricing" }, at: 2 },
      { label: { tr: "Greft aralığı", en: "Graft range" }, value: { tr: "2.000–4.000", en: "2,000–4,000" }, at: 5, mono: true },
      { label: { tr: "Tarih", en: "Date" }, value: { tr: "Perşembe 11:00", en: "Thu 11:00" }, at: 5 },
    ],
  },
  {
    tab: { tr: "Yurtdışı hasta", en: "International" },
    voice: "Deniz · sakin, çok dilli",
    caller: "+44 20 7946 0321",
    outcome: { tr: "Yurtdışı hasta · pakete yönlendirildi", en: "International · routed to package" },
    detail: { tr: "İngilizce görüşme · konaklama dahil paket · Pzt 10:00", en: "Handled in English · stay-included package · Mon 10:00" },
    turns: [
      { who: "agent", text: { tr: "Estetenova Hair Clinic, this is Deniz. How can I help you today?", en: "Estetenova Hair Clinic, this is Deniz. How can I help you today?" } },
      { who: "caller", text: { tr: "Hi — I'm flying from London. Do you arrange the hotel as well?", en: "Hi — I'm flying from London. Do you arrange the hotel as well?" } },
      { who: "agent", text: { tr: "We do. Our package covers the transfer, four nights and the aftercare visit.", en: "We do. Our package covers the transfer, four nights and the aftercare visit." } },
      { who: "caller", text: { tr: "That sounds good. Can we speak on Monday?", en: "That sounds good. Can we speak on Monday?" } },
      { who: "agent", text: { tr: "Booked for Monday 10:00 — I'm sending the details to your WhatsApp now.", en: "Booked for Monday 10:00 — I'm sending the details to your WhatsApp now." } },
    ],
    fields: [
      { label: { tr: "Numara", en: "Number" }, value: { tr: "+44 20 7946 0321", en: "+44 20 7946 0321" }, at: 1, mono: true },
      { label: { tr: "Görüşme dili", en: "Language" }, value: { tr: "İngilizce", en: "English" }, at: 2 },
      { label: { tr: "Talep", en: "Request" }, value: { tr: "Konaklama dahil paket", en: "Stay-included package" }, at: 2 },
      { label: { tr: "Tarih", en: "Date" }, value: { tr: "Pazartesi 10:00", en: "Mon 10:00" }, at: 4 },
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
