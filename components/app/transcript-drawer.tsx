"use client";

import { Icon } from "@/components/ui/icon";
import { Waveform } from "@/components/app/waveform";
import { OutcomePill } from "@/components/app/outcome-pill";
import { OUTCOME_TINT, type CallRow } from "@/lib/demo/data";
import { cn } from "@/lib/utils";

/**
 * The transcript drawer, shared by /calls and /dashboard — they used to each
 * define their own byte-for-byte identical copy (same problem as OutcomePill
 * before it was extracted to outcome-pill.tsx).
 *
 * There is no audio player: calls aren't recorded (KVKK — see artifactPlan in
 * lib/vapi/client.ts), so the transcript is the record of the call.
 */
export function TranscriptDrawer({
  call,
  onClose,
  lang,
  t,
  agentName,
}: {
  call: CallRow;
  onClose: () => void;
  lang: "tr" | "en";
  t: (v: { tr: string; en: string }) => string;
  agentName: string;
}) {
  const tint = OUTCOME_TINT[call.outcome];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="animate-float-up relative flex h-full w-full max-w-md flex-col border-l border-border bg-popover shadow-pop">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-soft font-mono text-[11px] font-bold text-violet">
            {avatarInitials(call.caller)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-tight">{call.caller}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{call.number} · {call.time}</p>
          </div>
          <OutcomePill outcome={call.outcome} lang={lang} />
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Waveform data={call.wave} width={300} height={22} color={tint} className="min-w-0 flex-1" />
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{call.duration}</span>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {lang === "tr" ? "Ajan" : "Agent"}: <span className="text-violet">{agentName}</span> · {t(call.summary)}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{lang === "tr" ? "Transkript" : "Transcript"}</p>
          <ul className="space-y-3">
            {call.transcript.map((turn, i) => (
              <li key={i} className={cn("flex flex-col", turn.who === "agent" ? "items-start" : "items-end")}>
                <span className="mb-0.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
                  {turn.who === "agent" ? <Icon name="bot" className="h-2.5 w-2.5 text-violet" /> : <Icon name="user" className="h-2.5 w-2.5" />}
                  {turn.who === "agent" ? "Randevox" : (lang === "tr" ? "Arayan" : "Caller")} · {fmt(turn.at)}
                </span>
                <span className={cn("max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-snug", turn.who === "agent" ? "rounded-tl-sm bg-violet-soft text-foreground" : "rounded-tr-sm bg-muted text-foreground")}>
                  {t(turn.text)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="border-t border-border px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <Icon name="list-checks" className="h-3 w-3 text-violet" />
            {lang === "tr" ? "Çıkarılan eylemler" : "Extracted action items"}
          </p>
          <ul className="space-y-1.5">
            {call.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px]">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full" style={{ background: "color-mix(in oklch, var(--color-booked) 16%, transparent)" }}>
                  <Icon name="check" className="h-2.5 w-2.5" style={{ color: "var(--color-booked)" }} />
                </span>
                <span className="text-foreground/90">{t(a)}</span>
              </li>
            ))}
          </ul>
        </footer>
      </div>
    </div>
  );
}

function avatarInitials(name: string) {
  if (name === "Unknown" || name === "Incoming") return "?";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2);
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
