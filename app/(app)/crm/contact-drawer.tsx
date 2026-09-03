"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { OutcomePill } from "@/components/app/outcome-pill";
import type { CrmContact } from "@/lib/crm/contacts";
import type { CrmRecord } from "@/lib/crm/types";
import type { Lang } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export interface ContactDrawerLabels {
  transcript: string;
  close: string;
  calls: string;
  lastContact: string;
  nextStep: string;
  noTranscript: string;
}

/**
 * One person's whole history: newest call first, each collapsed to a summary
 * line until it's opened. Deliberately not /calls' TranscriptDrawer — that one
 * is scoped to a single call and scrubs its waveform, which crm_records has no
 * amplitude data for.
 */
export function ContactDrawer({
  contact,
  onClose,
  lang,
  labels,
}: {
  contact: CrmContact;
  onClose: () => void;
  lang: Lang;
  labels: ContactDrawerLabels;
}) {
  const [openCallId, setOpenCallId] = useState<string | null>(contact.calls[0]?.id ?? null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label={labels.close} onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

      <div className="animate-float-up relative flex h-full w-full max-w-lg flex-col border-l border-border bg-popover shadow-pop">
        <header className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-soft font-mono text-[12px] font-bold text-violet">
            {avatarInitials(contact.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight">{contact.name}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{contact.number || "—"}</p>
            <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">
              {contact.callCount} {labels.calls} · {labels.lastContact}{" "}
              {new Date(contact.lastContactAt).toLocaleString(lang === "tr" ? "tr-TR" : "en-US")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </header>

        {contact.nextStep && (
          <div className="border-b border-border px-4 py-2.5">
            <p className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">{labels.nextStep}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-foreground/90">
              <Icon name="corner-down-right" className="h-3.5 w-3.5 shrink-0 text-violet" />
              {contact.nextStep}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ul className="space-y-2">
            {contact.calls.map((call) => (
              <li key={call.id} className="rounded-lg border border-border">
                <button
                  onClick={() => setOpenCallId((id) => (id === call.id ? null : call.id))}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-card/70"
                >
                  <Icon
                    name="chevron-right"
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                      openCallId === call.id && "rotate-90",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {new Date(call.started_at).toLocaleString(lang === "tr" ? "tr-TR" : "en-US")}
                      </span>
                      <OutcomePill outcome={call.outcome} lang={lang} />
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {call.agent_name} · {formatDuration(call.duration_sec)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug text-foreground/85">{call.summary}</p>
                  </div>
                </button>

                {openCallId === call.id && <Transcript call={call} lang={lang} labels={labels} />}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Transcript({ call, lang, labels }: { call: CrmRecord; lang: Lang; labels: ContactDrawerLabels }) {
  return (
    <div className="border-t border-border px-3 py-3">
      <p className="mb-2 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">{labels.transcript}</p>

      {call.transcript.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">{labels.noTranscript}</p>
      ) : (
        <ul className="space-y-3">
          {call.transcript.map((turn, i) => {
            const isAgent = turn.speaker === "agent" || turn.speaker === "assistant";
            return (
              <li key={i} className={cn("flex flex-col", isAgent ? "items-start" : "items-end")}>
                <span className="mb-0.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
                  {isAgent ? (
                    <Icon name="bot" className="h-2.5 w-2.5 text-violet" />
                  ) : (
                    <Icon name="user" className="h-2.5 w-2.5" />
                  )}
                  {isAgent ? (lang === "tr" ? "Ajan" : "Agent") : lang === "tr" ? "Arayan" : "Caller"}
                </span>
                <span
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-snug",
                    isAgent ? "rounded-tl-sm bg-violet-soft text-foreground" : "rounded-tr-sm bg-muted text-foreground",
                  )}
                >
                  {turn.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function avatarInitials(name: string) {
  if (!name || name === "Unknown") return "?";
  const letters = name
    .split(" ")
    .map((p) => p[0])
    .filter((c) => /\p{L}/u.test(c ?? ""))
    .join("");
  return letters.slice(0, 2).toUpperCase() || "?";
}

export function formatDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
