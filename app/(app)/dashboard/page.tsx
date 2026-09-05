"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { OutcomePill } from "@/components/app/outcome-pill";
import { TranscriptDrawer } from "@/components/app/transcript-drawer";
import { Waveform } from "@/components/app/waveform";
import { AreaChart, Donut } from "@/components/app/charts";
import { useLang } from "@/components/i18n/language-provider";
import {
  kpis as demoKpis,
  CALLS,
  LIVE_CALLS,
  AGENTS,
  outcomes as demoOutcomes,
  callVolume as demoCallVolume,
  volumeMeta,
  minutes,
  OUTCOME_LABEL,
  OUTCOME_TINT,
  SENTIMENT_LABEL,
  type DKpi,
  type CallRow,
  type Outcome,
  type Agent,
  type LiveCall,
} from "@/lib/demo/data";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchCalls } from "@/lib/calls/queries";
import { fetchAgents, saveAgent } from "@/lib/agents/queries";
import { useSession, useSampleData } from "@/components/auth/session";
import { usePrefs } from "@/lib/prefs";

const SENTIMENT_TINT: Record<string, string> = {
  positive: "var(--color-booked)",
  neutral: "var(--color-muted-foreground)",
  negative: "var(--color-missed)",
};

const HOUR_LABELS = ["12a", "1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p"];

function formatAvgDuration(totalSec: number, count: number): string {
  if (!count) return "0:00";
  const avg = Math.round(totalSec / count);
  return `${Math.floor(avg / 60)}:${String(avg % 60).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { lang, t } = useLang();
  const { demo } = useSession();
  // A real account starts empty and fills in from Supabase — never from the
  // demo arrays, which used to flash for the length of the first fetch.
  const sample = useSampleData();
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [openCall, setOpenCall] = useState<CallRow | null>(null);
  const [livePlaying, setLivePlaying] = useState(true);
  const { prefs } = usePrefs();
  useEffect(() => { setLivePlaying(prefs.liveTicker); }, [prefs.liveTicker]);
  const [calls, setCalls] = useState<CallRow[]>(sample ? CALLS : []);
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>(sample ? LIVE_CALLS : []);
  const [agents, setAgents] = useState<Agent[]>(sample ? AGENTS : []);
  const [live, setLive] = useState(!sample); // renders real rows (empty until the fetch lands) rather than the demo constants

  useEffect(() => {
    if (!isSupabaseConfigured || demo) return; // demo bypass stays fully local — never touches Supabase
    fetchCalls().then((rows) => {
      if (rows === null) return;
      setCalls(rows);
      setLiveCalls([]); // no real-time "call in progress" source yet — honest empty state instead of demo filler
      setLive(true);
    });
    fetchAgents().then((rows) => { if (rows !== null && rows.length) setAgents(rows); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  const L = {
    cockpit: lang === "tr" ? "Sesli ajan kokpiti" : "Voice agent cockpit",
    live: lang === "tr" ? "Canlı" : "Live",
    recentCalls: lang === "tr" ? "Son aramalar" : "Recent calls",
    liveCalls: lang === "tr" ? "Aktif aramalar" : "Live calls",
    agents: lang === "tr" ? "Sesli ajanlar" : "Voice agents",
    outcomes: lang === "tr" ? "Sonuç dağılımı" : "Outcomes breakdown",
    all: lang === "tr" ? "Tüm ajanlar" : "All agents",
    caller: lang === "tr" ? "Arayan" : "Caller",
    time: lang === "tr" ? "Saat" : "Time",
    duration: lang === "tr" ? "Süre" : "Duration",
    outcome: lang === "tr" ? "Sonuç" : "Outcome",
    sentiment: lang === "tr" ? "Duygu" : "Sentiment",
    none: lang === "tr" ? "Aktif arama yok." : "No live calls.",
    callsToday: lang === "tr" ? "bugün" : "today",
  };

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? "—";

  const rows = useMemo(() => {
    if (agentFilter === "all") return calls;
    return calls.filter((c) => c.agentId === agentFilter);
  }, [calls, agentFilter]);

  // Real KPIs/outcomes/volume once Supabase has answered; the demo constants
  // (with their "vs yesterday" deltas, which need a real history we don't
  // have yet) stay as the fallback and the very first render.
  const outcomeCounts = useMemo(() => {
    const counts: Record<Outcome, number> = { booked: 0, transferred: 0, voicemail: 0, resolved: 0, missed: 0 };
    for (const c of calls) counts[c.outcome]++;
    return counts;
  }, [calls]);

  const totalCalls = live ? calls.length : demoOutcomes.reduce((s, o) => s + o.value, 0);
  const outcomeList: { key: Outcome; value: number }[] = live
    ? (Object.keys(outcomeCounts) as Outcome[]).map((key) => ({ key, value: outcomeCounts[key] })).filter((o) => o.value > 0)
    : demoOutcomes;
  const donutSegments = outcomeList.map((o) => ({ key: o.key, value: o.value, tint: OUTCOME_TINT[o.key] }));

  const totalMinutes = useMemo(() => calls.reduce((s, c) => s + c.durationSec, 0) / 60, [calls]);
  const minutesUsed = live ? Math.round(totalMinutes) : minutes.used;
  const minutesPct = Math.round((minutesUsed / minutes.cap) * 100);

  const kpiList: DKpi[] = live
    ? [
        { label: demoKpis[0].label, value: String(calls.length), icon: demoKpis[0].icon },
        { label: demoKpis[1].label, value: formatAvgDuration(calls.reduce((s, c) => s + c.durationSec, 0), calls.length), icon: demoKpis[1].icon },
        { label: demoKpis[2].label, value: String(outcomeCounts.booked), icon: demoKpis[2].icon },
        { label: demoKpis[3].label, value: Math.round(totalMinutes).toLocaleString("en-US"), icon: demoKpis[3].icon },
      ]
    : demoKpis;

  const callVolume = useMemo(() => {
    if (!live) return demoCallVolume;
    const buckets = new Array(24).fill(0);
    for (const c of calls) {
      const [h] = c.time.split(":").map(Number);
      if (!Number.isNaN(h)) buckets[h]++;
    }
    // Same business-hours window the demo chart uses (8am–7pm) so the chart
    // doesn't stretch to show a wall of empty overnight bars.
    return HOUR_LABELS.slice(8, 20).map((label, i) => ({ label, value: buckets[i + 8] }));
  }, [live, calls]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 gap-4 p-3 sm:p-4 xl:grid-cols-[1fr_340px]">
        {/* ════════════════ MAIN COLUMN ════════════════ */}
        <div className="min-w-0 space-y-3">
          {/* Header + agent filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-[18px] font-bold tracking-tight">{L.cockpit}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-violet/30 bg-violet-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-violet">
                <span className="h-1.5 w-1.5 rounded-full bg-violet pulse-dot" />
                {L.live}
              </span>
            </div>
            <div className="ml-auto">
              <AgentFilter value={agentFilter} onChange={setAgentFilter} allLabel={L.all} agents={agents} />
            </div>
          </div>

          {/* KPI summary strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {kpiList.map((k) => (
              <div key={k.label.en} className="rounded-lg border border-border bg-card/30 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k.label[lang]}</p>
                  {k.icon && <Icon name={k.icon} className="h-3.5 w-3.5 text-muted-foreground/60" />}
                </div>
                <p className="mt-1 font-mono text-[17px] font-semibold tabular-nums">{k.value}</p>
                {k.delta !== undefined && (
                  <p className={cn("font-mono text-[10.5px] tabular-nums", k.delta >= 0 ? "text-violet" : "text-muted-foreground")}>
                    {k.delta > 0 ? "+" : ""}{k.delta}% <span className="text-muted-foreground">{k.hint?.[lang]}</span>
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Recent calls log */}
          <section className="rounded-lg border border-border bg-card/30">
            <header className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Icon name="phone-incoming" className="h-3.5 w-3.5 text-violet" />
                {L.recentCalls}
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{rows.length} {lang === "tr" ? "arama" : "calls"}</span>
            </header>

            {/* column headers */}
            <div className="hidden grid-cols-[1.4fr_0.7fr_0.7fr_1fr_0.9fr] gap-2 border-b border-border/60 px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground sm:grid">
              <span>{L.caller}</span>
              <span>{L.time}</span>
              <span>{L.duration}</span>
              <span>{L.outcome}</span>
              <span className="text-right">{L.sentiment}</span>
            </div>

            <ul className="divide-y divide-border/60">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setOpenCall(c)}
                    className="grid w-full grid-cols-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-card/70 sm:grid-cols-[1.4fr_0.7fr_0.7fr_1fr_0.9fr]"
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
                    <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{c.time}</span>
                    <div className="flex items-center gap-2">
                      <Waveform data={c.wave} width={40} height={18} color="var(--color-muted-foreground)" className="hidden md:block" />
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
          </section>

          {/* Charts row: call volume + outcomes donut */}
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            <section className="rounded-lg border border-border bg-card/30 p-3">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t(volumeMeta.title)}</p>
                  <p className="font-mono text-[18px] font-semibold tabular-nums">
                    {totalCalls} {!live && <span className="text-[11px] font-normal text-violet">{volumeMeta.delta}</span>}
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t(volumeMeta.subtitle)}</span>
              </div>
              <AreaChart data={callVolume} height={172} />
            </section>

            <section className="rounded-lg border border-border bg-card/30 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{L.outcomes}</p>
              <div className="flex items-center gap-4">
                <Donut segments={donutSegments} size={150} thickness={20} centerTop={String(totalCalls)} centerLabel={lang === "tr" ? "ARAMA" : "CALLS"} />
                <ul className="flex-1 space-y-1.5">
                  {outcomeList.map((o) => {
                    const pct = totalCalls ? Math.round((o.value / totalCalls) * 100) : 0;
                    return (
                      <li key={o.key} className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="h-2 w-2 rounded-[3px]" style={{ background: OUTCOME_TINT[o.key] }} />
                        <span className="flex-1 text-muted-foreground">{t(OUTCOME_LABEL[o.key])}</span>
                        <span className="tabular-nums text-foreground">{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          </div>

          {/* Minutes-used meter */}
          <section className="rounded-lg border border-border bg-card/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t(minutes.label)}</p>
              <p className="font-mono text-[12px] font-semibold tabular-nums">{minutesUsed.toLocaleString("en-US")} / {minutes.cap.toLocaleString("en-US")}</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${minutesPct}%`, background: "var(--grad-brand)" }} />
            </div>
            <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
              {lang === "tr" ? `Aylık paketinizin %${minutesPct}'i` : `${minutesPct}% of your monthly allowance`}
            </p>
          </section>
        </div>

        {/* ════════════════ RIGHT RAIL ════════════════ */}
        <aside className="space-y-3">
          {/* Live calls panel */}
          <section className="rounded-lg border border-violet/30 bg-card/30">
            <header className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
                <span className="relative grid h-4 w-4 place-items-center">
                  <span className="absolute h-3.5 w-3.5 rounded-full bg-violet/40 ping-ring" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet" />
                </span>
                {L.liveCalls}
              </h2>
              <button
                onClick={() => setLivePlaying((p) => !p)}
                aria-pressed={livePlaying}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon name={livePlaying ? "pause" : "play"} className="h-3 w-3" />
                {livePlaying ? (lang === "tr" ? "Duraklat" : "Pause") : (lang === "tr" ? "Oynat" : "Play")}
              </button>
            </header>
            {liveCalls.length === 0 ? (
              <div className="grid place-items-center py-8 text-[12px] text-muted-foreground">{L.none}</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {liveCalls.map((lc) => (
                  <li key={lc.id} className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{lc.number}</span>
                      <span className="ml-auto font-mono text-[11px] font-semibold tabular-nums text-violet">{lc.elapsed}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Waveform data={[0.4, 0.8, 0.5, 0.9, 0.6, 0.3, 0.7, 0.5, 0.8, 0.4, 0.6, 0.9]} animated playing={livePlaying} width={150} height={22} />
                      <span className="ml-auto rounded bg-violet-soft px-1.5 py-0.5 font-mono text-[9.5px] text-violet">{agentName(lc.agentId)}</span>
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
                      <Icon name="loader" className={cn("h-3 w-3", livePlaying && "animate-spin")} />
                      {t(lc.stage)}…
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Voice agents list */}
          <AgentsPanel lang={lang} t={t} title={L.agents} callsTodayLabel={L.callsToday} agents={agents} setAgents={setAgents} />
        </aside>
      </div>

      {/* Transcript drawer */}
      {openCall && <TranscriptDrawer call={openCall} onClose={() => setOpenCall(null)} lang={lang} t={t} agentName={agentName(openCall.agentId)} />}
    </div>
  );
}

/* ────────────────────────── sub-components ────────────────────────── */

function avatarInitials(name: string) {
  if (name === "Unknown" || name === "Incoming") return "?";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2);
}

function AgentFilter({ value, onChange, allLabel, agents }: { value: string; onChange: (v: string) => void; allLabel: string; agents: Agent[] }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
      <FilterBtn active={value === "all"} onClick={() => onChange("all")} label={allLabel} />
      {agents.filter((a) => a.active).map((a) => (
        <FilterBtn key={a.id} active={value === a.id} onClick={() => onChange(a.id)} label={a.name} />
      ))}
    </div>
  );
}

function FilterBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded px-2 py-1 text-[11.5px] font-medium transition-colors",
        active ? "bg-violet-soft text-violet" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function AgentsPanel({
  lang,
  t,
  title,
  callsTodayLabel,
  agents,
  setAgents,
}: {
  lang: "tr" | "en";
  t: (v: { tr: string; en: string }) => string;
  title: string;
  callsTodayLabel: string;
  agents: Agent[];
  setAgents: (fn: (list: Agent[]) => Agent[]) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card/30">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Icon name="bot" className="h-3.5 w-3.5 text-cyan" />
          {title}
        </h2>
        <Link href="/agents" className="font-mono text-[10px] uppercase tracking-wider text-violet transition-opacity hover:opacity-70">+ {lang === "tr" ? "Yeni" : "New"}</Link>
      </header>
      <ul className="divide-y divide-border/60">
        {agents.map((a) => (
          <li key={a.id} className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-cyan-soft text-cyan">
              <Icon name="bot" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold leading-tight">{a.name}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{a.voice}</p>
              <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{t(a.purpose)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono text-[11px] font-semibold tabular-nums">{a.callsToday} <span className="text-[9px] font-normal text-muted-foreground">{callsTodayLabel}</span></span>
              <button
                onClick={() => {
                  const toggled: Agent = { ...a, active: !a.active };
                  setAgents((list) => list.map((x) => (x.id === a.id ? toggled : x)));
                  if (isSupabaseConfigured) saveAgent(toggled);
                }}
                aria-pressed={a.active}
                className={cn("relative h-4 w-7 rounded-full border transition-colors", a.active ? "border-transparent bg-violet/40" : "border-border bg-muted")}
              >
                <span className={cn("absolute top-0.5 h-3 w-3 rounded-full transition-all", a.active ? "left-[14px] bg-violet" : "left-0.5 bg-foreground/60")} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
