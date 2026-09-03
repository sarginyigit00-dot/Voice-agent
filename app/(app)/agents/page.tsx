"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Waveform } from "@/components/app/waveform";
import { useLang } from "@/components/i18n/language-provider";
import { AGENTS, VOICES, BUILDER_ACTIONS, type Agent } from "@/lib/demo/data";
import { ACTION_HINT } from "@/lib/actions/registry";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchAgents, seedAgents, insertAgent, saveAgent, deleteAgent } from "@/lib/agents/queries";
import { useSession } from "@/components/auth/session";
import { DAY_KEYS, DAY_LABEL, defaultWorkingHours, normalizeWorkingHours, type DayKey, type WorkingHours } from "@/lib/agents/hours";

const STORAGE_KEY = "randevox:agents";

export default function AgentsPage() {
  const { lang, t } = useLang();
  const { demo } = useSession();
  // Demo bypass stays fully local — never reads or writes Supabase, even
  // when the workspace has real keys configured.
  const live = isSupabaseConfigured && !demo;
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [selectedId, setSelectedId] = useState<string>(AGENTS[0].id);
  const [voice, setVoice] = useState<string>(AGENTS[0].voice);
  const [actions, setActions] = useState(BUILDER_ACTIONS);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const greetingRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const purposeRef = useRef<HTMLTextAreaElement>(null);
  const systemPromptRef = useRef<HTMLTextAreaElement>(null);

  const selected = agents.find((a) => a.id === selectedId) ?? agents[0];

  // Working hours are edited as live state (not a ref like the textareas) so
  // the day rows re-render as they're toggled.
  const [hours, setHours] = useState<WorkingHours>(selected.workingHours);
  useEffect(() => {
    setHours(selected.workingHours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Sync the actions toggles to whichever agent is selected, so switching
  // agents shows that agent's own eylem set instead of a stale/shared one.
  // Matches by action id (not translated label text), so this stays correct
  // regardless of which UI language is active.
  useEffect(() => {
    setActions(BUILDER_ACTIONS.map((a) => ({ ...a, on: selected.actionIds.includes(a.id) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // With Supabase configured, agents live in the `agents` table and every
  // team member sees the same list. A brand-new (empty) workspace is seeded
  // with the same starter agents the demo ships, once, so /agents isn't a
  // blank page on first sign-in. Without Supabase, fall back to the old
  // per-browser localStorage persistence — runs once on mount, after the
  // server-matching first render, to avoid a hydration mismatch.
  useEffect(() => {
    if (live) {
      fetchAgents().then(async (loaded) => {
        if (loaded === null) return; // request failed — keep the AGENTS default
        if (loaded.length === 0) {
          await seedAgents(AGENTS);
          loaded = AGENTS;
        }
        setAgents(loaded);
        setSelectedId(loaded[0].id);
        setVoice(loaded[0].voice);
        setHours(loaded[0].workingHours);
      });
      return;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: Agent[] = JSON.parse(raw);
      // Agents saved before actionIds existed (old shape had `actions: L[]`)
      // would crash `selected.actionIds.includes(...)` below — drop the
      // stale field shape instead of trusting it.
      const loaded = parsed.map((a) => ({
        ...a,
        actionIds: Array.isArray(a.actionIds) ? a.actionIds : [],
        systemPrompt: typeof a.systemPrompt === "string" ? a.systemPrompt : "",
        workingHours: normalizeWorkingHours(a.workingHours),
      }));
      if (loaded.length) {
        setAgents(loaded);
        setSelectedId(loaded[0].id);
        setVoice(loaded[0].voice);
        setHours(normalizeWorkingHours(loaded[0].workingHours));
      }
    } catch {
      // ignore corrupt/inaccessible storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  useEffect(() => {
    if (live) return; // Supabase writes happen per-action instead (see handlers below)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    } catch {
      // ignore quota/access errors — edits still work for this session
    }
  }, [agents]);

  const L = {
    title: lang === "tr" ? "Sesli ajanlar" : "Voice agents",
    sub: lang === "tr" ? "Telefonu kimin açtığını, nasıl konuştuğunu ve ne yaptığını yönet." : "Manage who answers, how they sound, and what they do.",
    newAgent: lang === "tr" ? "Yeni ajan" : "New agent",
    newAgentName: lang === "tr" ? "Yeni ajan" : "New agent",
    newAgentPurpose: { tr: "Henüz yapılandırılmadı — aşağıdan düzenle.", en: "Not configured yet — edit it below." },
    newAgentGreeting: { tr: "Merhaba, size nasıl yardımcı olabilirim?", en: "Hi, how can I help you today?" },
    callsToday: lang === "tr" ? "bugün arama" : "calls today",
    active: lang === "tr" ? "Aktif" : "Active",
    paused: lang === "tr" ? "Duraklatıldı" : "Paused",
    name: lang === "tr" ? "Ajan adı" : "Agent name",
    purpose: lang === "tr" ? "Açıklama" : "Purpose",
    greeting: lang === "tr" ? "Karşılama" : "Greeting prompt",
    voice: lang === "tr" ? "Ses" : "Voice",
    actions: lang === "tr" ? "Eylemler" : "Actions",
    preview: lang === "tr" ? "Sesi önizle" : "Preview voice",
    save: lang === "tr" ? "Değişiklikleri kaydet" : "Save changes",
    saved: lang === "tr" ? "Kaydedildi" : "Saved",
    deleteAgent: lang === "tr" ? "Ajanı sil" : "Delete agent",
    lastAgentHint: lang === "tr" ? "En az bir ajan kalmalı" : "At least one agent must remain",
    systemPrompt: lang === "tr" ? "İşletme talimatları" : "Business instructions",
    systemPromptHint:
      lang === "tr"
        ? "Hizmetler, fiyat politikası, adres, neyi cevaplamayacağı. Ajan bunları bilerek konuşur."
        : "Services, pricing policy, address, what not to answer. This is what the agent knows.",
    systemPromptPlaceholder:
      lang === "tr"
        ? "Örn: Hizmetler: konsültasyon (ücretsiz, 30 dk), FUE saç ekimi…\nFiyat sorulursa telefonda rakam verme.\nTıbbi soruları doktora aktar."
        : "e.g. Services: consultation (free, 30 min), FUE transplant…\nDon't quote prices on the phone.\nHand medical questions to a doctor.",
    hours: lang === "tr" ? "Çalışma saatleri" : "Working hours",
    hoursHint:
      lang === "tr"
        ? "Ajan bu saatlerin dışına randevu vermez — takvimde boş görünse bile."
        : "The agent never books outside these hours — even if the calendar looks free.",
    closed: lang === "tr" ? "Kapalı" : "Closed",
    timezone: lang === "tr" ? "Saat dilimi" : "Timezone",
  };

  const handleNewAgent = () => {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ag-new-${Date.now()}`;
    const created: Agent = {
      id,
      name: `${L.newAgentName} ${agents.length + 1}`,
      voice: VOICES[0],
      purpose: L.newAgentPurpose,
      callsToday: 0,
      active: false,
      greeting: L.newAgentGreeting,
      actionIds: [],
      systemPrompt: "",
      workingHours: defaultWorkingHours(),
    };
    setAgents((list) => [created, ...list]);
    setSelectedId(id);
    setVoice(created.voice);
    setHours(created.workingHours);
    setActions(BUILDER_ACTIONS.map((a) => ({ ...a, on: false })));
    if (live) insertAgent(created);
  };

  const handleSave = () => {
    const greetingText = greetingRef.current?.value ?? t(selected.greeting);
    const nameText = nameRef.current?.value.trim() || selected.name;
    const purposeText = purposeRef.current?.value ?? t(selected.purpose);
    const updated: Agent = {
      ...selected,
      name: nameText,
      voice,
      purpose: { ...selected.purpose, [lang]: purposeText },
      greeting: { ...selected.greeting, [lang]: greetingText },
      actionIds: actions.filter((a) => a.on).map((a) => a.id),
      systemPrompt: systemPromptRef.current?.value ?? selected.systemPrompt,
      workingHours: hours,
    };
    setAgents((list) => list.map((x) => (x.id === selected.id ? updated : x)));
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1600);
    if (live) saveAgent(updated);
  };

  const handleDeleteAgent = (id: string) => {
    if (agents.length <= 1) return;
    const remaining = agents.filter((a) => a.id !== id);
    setAgents(remaining);
    if (selectedId === id) {
      const next = remaining[0];
      setSelectedId(next.id);
      setVoice(next.voice);
      setHours(next.workingHours);
    }
    if (live) deleteAgent(id);
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[20px] font-bold tracking-tight">{L.title}</h1>
          <p className="text-[13px] text-muted-foreground">{L.sub}</p>
        </div>
        <button
          onClick={handleNewAgent}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--color-violet)", color: "var(--color-primary-foreground)" }}
        >
          <Icon name="plus" className="h-4 w-4" />
          {L.newAgent}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* agents list */}
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((a) => (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => { setSelectedId(a.id); setVoice(a.voice); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(a.id);
                  setVoice(a.voice);
                }
              }}
              className={cn(
                "cursor-pointer rounded-lg border bg-card/30 p-3 text-left transition-colors",
                selectedId === a.id ? "border-violet/50 shadow-soft" : "border-border hover:border-violet/30",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-violet-soft text-violet">
                  <Icon name="bot" className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold leading-tight">{a.name}</p>
                  <p className="truncate font-mono text-[10.5px] text-muted-foreground">{a.voice}</p>
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold"
                  style={{
                    color: a.active ? "var(--color-booked)" : "var(--color-muted-foreground)",
                    background: a.active ? "color-mix(in oklch, var(--color-booked) 14%, transparent)" : "var(--color-muted)",
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.active ? "var(--color-booked)" : "var(--color-muted-foreground)" }} />
                  {a.active ? L.active : L.paused}
                </span>
                {agents.length > 1 && (
                  <button
                    type="button"
                    title={L.deleteAgent}
                    aria-label={L.deleteAgent}
                    onClick={(e) => { e.stopPropagation(); handleDeleteAgent(a.id); }}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Icon name="trash-2" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{t(a.purpose)}</p>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
                <span className="font-mono text-[11px] tabular-nums">
                  <span className="font-semibold text-foreground">{a.callsToday}</span> <span className="text-muted-foreground">{L.callsToday}</span>
                </span>
                <span
                  role="switch"
                  aria-checked={a.active}
                  onClick={(e) => {
                    e.stopPropagation();
                    const toggled: Agent = { ...a, active: !a.active };
                    setAgents((list) => list.map((x) => (x.id === a.id ? toggled : x)));
                    if (live) saveAgent(toggled);
                  }}
                  className={cn("relative h-4 w-7 cursor-pointer rounded-full border transition-colors", a.active ? "border-transparent bg-violet/40" : "border-border bg-muted")}
                >
                  <span className={cn("absolute top-0.5 h-3 w-3 rounded-full transition-all", a.active ? "left-[14px] bg-violet" : "left-0.5 bg-foreground/60")} />
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* agent-builder detail */}
        <aside className="rounded-lg border border-border bg-card/30">
          <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Icon name="sliders-horizontal" className="h-3.5 w-3.5 text-violet" />
              {selected.name}
            </h2>
            <button
              type="button"
              title={agents.length > 1 ? L.deleteAgent : L.lastAgentHint}
              aria-label={L.deleteAgent}
              disabled={agents.length <= 1}
              onClick={() => handleDeleteAgent(selected.id)}
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
            >
              <Icon name="trash-2" className="h-3.5 w-3.5" />
            </button>
          </header>
          <div className="space-y-3.5 p-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{L.name}</label>
              <input
                key={`${selected.id}-name`}
                ref={nameRef}
                defaultValue={selected.name}
                className="mt-1 w-full rounded-md border border-border bg-background/60 px-2.5 py-2 text-[12.5px] font-semibold text-foreground outline-none focus:border-violet/60"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{L.purpose}</label>
              <textarea
                key={`${selected.id}-purpose`}
                ref={purposeRef}
                defaultValue={t(selected.purpose)}
                rows={2}
                className="mt-1 w-full resize-none rounded-md border border-border bg-background/60 px-2.5 py-2 text-[12.5px] leading-snug text-foreground outline-none focus:border-violet/60"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{L.greeting}</label>
              <textarea
                key={selected.id}
                ref={greetingRef}
                defaultValue={t(selected.greeting)}
                rows={3}
                className="mt-1 w-full resize-none rounded-md border border-border bg-background/60 px-2.5 py-2 text-[12.5px] leading-snug text-foreground outline-none focus:border-violet/60"
              />
            </div>

            {/* The clinic's own instructions — the field that was missing, and
                the reason an agent can finally be told about this business. */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{L.systemPrompt}</label>
              <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{L.systemPromptHint}</p>
              <textarea
                key={`${selected.id}-system`}
                ref={systemPromptRef}
                defaultValue={selected.systemPrompt}
                placeholder={L.systemPromptPlaceholder}
                rows={8}
                className="mt-1.5 w-full resize-y rounded-md border border-border bg-background/60 px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-violet/60"
              />
            </div>

            {/* Working hours — enforced in lib/booking/tools.ts, not decoration. */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{L.hours}</label>
              <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{L.hoursHint}</p>
              <ul className="mt-1.5 space-y-1">
                {DAY_KEYS.map((day: DayKey) => {
                  const d = hours.days[day];
                  return (
                    <li key={day} className="flex items-center gap-1.5">
                      <span className="w-[64px] shrink-0 truncate text-[11.5px]">{t(DAY_LABEL[day])}</span>
                      <input
                        type="time"
                        value={d.open}
                        disabled={d.closed}
                        aria-label={`${t(DAY_LABEL[day])} — ${L.hours}`}
                        onChange={(e) =>
                          setHours((h) => ({ ...h, days: { ...h.days, [day]: { ...d, open: e.target.value } } }))
                        }
                        className="w-[74px] rounded border border-border bg-background/60 px-1.5 py-1 font-mono text-[11px] tabular-nums outline-none focus:border-violet/60 disabled:opacity-35"
                      />
                      <span className="text-[11px] text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={d.close}
                        disabled={d.closed}
                        aria-label={`${t(DAY_LABEL[day])} — ${L.closed}`}
                        onChange={(e) =>
                          setHours((h) => ({ ...h, days: { ...h.days, [day]: { ...d, close: e.target.value } } }))
                        }
                        className="w-[74px] rounded border border-border bg-background/60 px-1.5 py-1 font-mono text-[11px] tabular-nums outline-none focus:border-violet/60 disabled:opacity-35"
                      />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!d.closed}
                        title={L.closed}
                        onClick={() =>
                          setHours((h) => ({ ...h, days: { ...h.days, [day]: { ...d, closed: !d.closed } } }))
                        }
                        className={cn(
                          "relative ml-auto h-4 w-7 shrink-0 rounded-full border transition-colors",
                          d.closed ? "border-border bg-muted" : "border-transparent bg-violet/40",
                        )}
                      >
                        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full transition-all", d.closed ? "left-0.5 bg-foreground/60" : "left-[14px] bg-violet")} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{L.timezone}</label>
                <input
                  value={hours.timeZone}
                  onChange={(e) => setHours((h) => ({ ...h, timeZone: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background/60 px-2.5 py-1.5 font-mono text-[11px] outline-none focus:border-violet/60"
                />
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{L.voice}</label>
              <div className="mt-1.5 space-y-1">
                {VOICES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVoice(v)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors",
                      voice === v ? "border-violet/50 bg-violet-soft text-violet" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon name="audio-lines" className="h-3.5 w-3.5" />
                    {v}
                    {voice === v && <Icon name="check" className="ml-auto h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* voice preview */}
            <div className="rounded-md border border-border bg-background/60 p-2.5">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setPreviewPlaying((p) => !p)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                  style={{ background: "var(--color-violet)", color: "var(--color-primary-foreground)" }}
                >
                  <Icon name={previewPlaying ? "pause" : "play"} className="h-3.5 w-3.5" />
                </button>
                <Waveform data={[0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.6, 0.3, 0.7, 0.5, 0.9, 0.4, 0.6, 0.8, 0.5]} animated playing={previewPlaying} width={220} height={26} className="flex-1" />
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{L.preview} · {voice.split(" · ")[0]}</p>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{L.actions}</label>
              <ul className="mt-1.5 space-y-1.5">
                {actions.map((a) => {
                  const hint = ACTION_HINT[a.id];
                  return (
                    <li key={a.id}>
                      <div className="flex items-center gap-2">
                        <Icon name="zap" className="h-3 w-3 text-violet" />
                        <span className="text-[12px]">{t(a.label)}</span>
                        <button
                          onClick={() => setActions((list) => list.map((x) => (x.id === a.id ? { ...x, on: !x.on } : x)))}
                          aria-pressed={a.on}
                          className={cn("relative ml-auto h-4 w-7 rounded-full border transition-colors", a.on ? "border-transparent bg-violet/40" : "border-border bg-muted")}
                        >
                          <span className={cn("absolute top-0.5 h-3 w-3 rounded-full transition-all", a.on ? "left-[14px] bg-violet" : "left-0.5 bg-foreground/60")} />
                        </button>
                      </div>
                      {hint && a.on && <p className="ml-5 mt-0.5 text-[10.5px] text-muted-foreground">{t(hint)}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>

            <button
              onClick={handleSave}
              className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--color-violet)", color: "var(--color-primary-foreground)" }}
            >
              <Icon name={justSaved ? "check" : "save"} className="h-3.5 w-3.5" />
              {justSaved ? L.saved : L.save}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
