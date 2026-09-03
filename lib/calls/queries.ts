"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { CallRow, Outcome, Sentiment, Turn } from "@/lib/demo/data";

/** Shape of a row in the `calls` table (supabase/schema.sql). */
interface CallRowDb {
  id: string;
  agent_id: string | null;
  caller_name: string;
  caller_number: string;
  started_at: string;
  duration_sec: number;
  outcome: string;
  summary: string;
  transcript: { speaker: string; text: string; atSec: number }[];
  actions: string[];
  sentiment: string;
  recording_url: string | null;
}

/** Stable pseudo-random waveform sparkline derived from the call id — no real amplitude data exists past the call. */
function waveFor(id: string): number[] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return Array.from({ length: 13 }, () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return 0.3 + (h % 1000) / 1428.6; // 0.3..1.0
  });
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fromRow(r: CallRowDb): CallRow {
  return {
    id: r.id,
    caller: r.caller_name,
    number: r.caller_number,
    agentId: r.agent_id ?? "",
    time: formatTime(r.started_at),
    duration: formatDuration(r.duration_sec),
    durationSec: r.duration_sec,
    outcome: r.outcome as Outcome,
    // Computed post-call from the transcript — see lib/calls/sentiment.ts.
    // A value outside the known three (a row written before this existed, or
    // a DB edited by hand) falls back to neutral rather than rendering blank.
    sentiment: (["positive", "neutral", "negative"] as const).includes(r.sentiment as Sentiment)
      ? (r.sentiment as Sentiment)
      : "neutral",
    recordingUrl: r.recording_url,
    wave: waveFor(r.id),
    summary: { tr: r.summary, en: r.summary },
    actions: r.actions.map((note) => ({ tr: note, en: note })),
    transcript: (r.transcript ?? []).map(
      (t): Turn => ({ who: t.speaker === "assistant" || t.speaker === "agent" ? "agent" : "caller", at: t.atSec, text: { tr: t.text, en: t.text } }),
    ),
  };
}

/**
 * Reads the call log for the team. Returns null when Supabase isn't
 * configured or the request fails — callers fall back to demo data.
 */
export async function fetchCalls(limit = 100): Promise<CallRow[] | null> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[calls] failed to list calls:", error.message);
    return null;
  }
  return (data as CallRowDb[]).map(fromRow);
}
