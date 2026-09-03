"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Waveform } from "@/components/app/waveform";
import { OutcomePill } from "@/components/app/outcome-pill";
import { TranscriptDrawer } from "@/components/app/transcript-drawer";
import { useLang } from "@/components/i18n/language-provider";
import {
  CALLS,
  AGENTS,
  OUTCOME_LABEL,
  OUTCOME_TINT,
  SENTIMENT_LABEL,
  type Agent,
  type CallRow,
  type Outcome,
} from "@/lib/demo/data";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchCalls } from "@/lib/calls/queries";
import { fetchAgents } from "@/lib/agents/queries";
import { useSession } from "@/components/auth/session";

const SENTIMENT_TINT: Record<string, string> = {
  positive: "var(--color-booked)",
  neutral: "var(--color-muted-foreground)",
  negative: "var(--color-missed)",
};

const OUTCOME_KEYS: Outcome[] = ["booked", "resolved", "transferred", "voicemail", "missed"];

/**
 * useSearchParams() opts the subtree into client-side rendering, so Next
 * requires it to sit under a Suspense boundary — without one the production
 * build fails to prerender /calls.
 */
export default function CallsPage() {
  return (
    <Suspense fallback={null}>
      <CallsView />
    </Suspense>
  );
}

function CallsView() {
  const { lang, t } = useLang();
  const { demo } = useSession();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<Outcome | "all">("all");
  const [query, setQuery] = useState("");
  const [openCall, setOpenCall] = useState<CallRow | null>(null);
  const [calls, setCalls] = useState<CallRow[]>(CALLS);
  const [agents, setAgents] = useState<Agent[]>(AGENTS);

  // Real data once Supabase is connected — the demo arrays above stay as the
  // initial render and as the fallback when Supabase isn't configured, or
  // when the visitor is in the demo bypass (which stays fully local).
  useEffect(() => {
    if (!isSupabaseConfigured || demo) return;
    fetchCalls().then((rows) => { if (rows !== null) setCalls(rows); });
    fetchAgents().then((rows) => { if (rows !== null && rows.length) setAgents(rows); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  useEffect(() => {
    // On a soft navigation from the nav search, useSearchParams has the query.
    // On a hard load / refresh this page is served from its prerendered shell,
    // where it comes back empty — so fall back to the real URL.
    const q = searchParams.get("q") ?? new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, [searchParams]);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? "—";

  const outcomeCounts = useMemo(() => {
    const counts: Record<Outcome, number> = { booked: 0, transferred: 0, voicemail: 0, resolved: 0, missed: 0 };
    for (const c of calls) counts[c.outcome]++;
    return counts;
  }, [calls]);

  const rows = useMemo(() => {
    let r = calls;
    if (filter !== "all") r = r.filter((c) => c.outcome === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((c) => c.caller.toLowerCase().includes(q) || c.number.includes(q));
    }
    return r;
  }, [calls, filter, query]);

  const L = {
    title: lang === "tr" ? "Aramalar" : "Calls",
    sub: lang === "tr" ? "Her aramanın kaydı, transkripti ve sonucu." : "A log, transcript and outcome for every call.",
    all: lang === "tr" ? "Tümü" : "All",
    search: lang === "tr" ? "Arayan veya numara ara…" : "Search caller or number…",
    caller: lang === "tr" ? "Arayan" : "Caller",
    agent: lang === "tr" ? "Ajan" : "Agent",
    time: lang === "tr" ? "Saat" : "Time",
    duration: lang === "tr" ? "Süre" : "Duration",
    outcome: lang === "tr" ? "Sonuç" : "Outcome",
    empty: lang === "tr" ? "Eşleşen arama yok." : "No matching calls.",
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4 p-3 sm:p-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[20px] font-bold tracking-tight">{L.title}</h1>
          <p className="text-[13px] text-muted-foreground">{L.sub}</p>
        </div>
        <div className="flex h-9 w-full max-w-xs items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[13px] text-muted-foreground">
          <Icon name="search" className="h-3.5 w-3.5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={L.search}
            className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* outcome stat chips */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {OUTCOME_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setFilter((f) => (f === k ? "all" : k))}
            className={cn(
              "rounded-lg border bg-card/30 px-3 py-2.5 text-left transition-colors",
              filter === k ? "border-violet/50" : "border-border hover:border-border",
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: OUTCOME_TINT[k] }} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t(OUTCOME_LABEL[k])}</span>
            </span>
            <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums">{outcomeCounts[k]}</p>
          </button>
        ))}
      </div>

      {/* filter row */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{lang === "tr" ? "Filtre" : "Filter"}:</span>
        <button
          onClick={() => setFilter("all")}
          className={cn("rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors", filter === "all" ? "bg-violet-soft text-violet" : "text-muted-foreground hover:text-foreground")}
        >
          {L.all}
        </button>
        {OUTCOME_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn("rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors", filter === k ? "bg-violet-soft text-violet" : "text-muted-foreground hover:text-foreground")}
          >
            {t(OUTCOME_LABEL[k])}
          </button>
        ))}
      </div>

      {/* table */}
      <section className="rounded-lg border border-border bg-card/30">
        <div className="hidden grid-cols-[1.6fr_0.9fr_0.7fr_0.8fr_1fr_0.8fr] gap-2 border-b border-border px-3 py-2 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground md:grid">
          <span>{L.caller}</span>
          <span>{L.agent}</span>
          <span>{L.time}</span>
          <span>{L.duration}</span>
          <span>{L.outcome}</span>
          <span className="text-right">{t(SENTIMENT_LABEL.neutral).slice(0, 0)}{lang === "tr" ? "Duygu" : "Sentiment"}</span>
        </div>
        {rows.length === 0 ? (
          <div className="grid place-items-center py-16 text-[13px] text-muted-foreground">{L.empty}</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setOpenCall(c)}
                  className="grid w-full grid-cols-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-card/70 md:grid-cols-[1.6fr_0.9fr_0.7fr_0.8fr_1fr_0.8fr]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-soft font-mono text-[10px] font-bold text-violet">
                      {avatarInitials(c.caller)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium leading-tight">{c.caller}</p>
                      <p className="truncate font-mono text-[10.5px] text-muted-foreground">{c.number}</p>
                    </div>
                  </div>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">{agentName(c.agentId)}</span>
                  <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{c.time}</span>
                  <div className="flex items-center gap-2">
                    <Waveform data={c.wave} width={32} height={16} color="var(--color-muted-foreground)" className="hidden lg:block" />
                    <span className="font-mono text-[12px] tabular-nums">{c.duration}</span>
                  </div>
                  <OutcomePill outcome={c.outcome} lang={lang} />
                  <span className="flex items-center justify-end gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: SENTIMENT_TINT[c.sentiment] }} />
                    <span className="hidden font-mono text-[10.5px] text-muted-foreground sm:inline">{t(SENTIMENT_LABEL[c.sentiment])}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {openCall && <TranscriptDrawer call={openCall} onClose={() => setOpenCall(null)} lang={lang} t={t} agentName={agentName(openCall.agentId)} />}
    </div>
  );
}

/* shared with dashboard's drawer pattern */
function avatarInitials(name: string) {
  if (name === "Unknown" || name === "Incoming") return "?";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2);
}

