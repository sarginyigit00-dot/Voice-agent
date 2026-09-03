"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useLang } from "@/components/i18n/language-provider";
import { AGENTS, demoAppointments, type Agent } from "@/lib/demo/data";
import {
  fetchAppointments,
  cancelAppointment,
  fetchAvailableSlots,
  rescheduleAppointment,
  type Appointment,
  type AvailableSlot,
} from "@/lib/appointments/queries";
import { fetchAgents } from "@/lib/agents/queries";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useSession } from "@/components/auth/session";
import { cn } from "@/lib/utils";

type Filter = "upcoming" | "past" | "cancelled" | "all";

/**
 * /randevular — the appointments the agent actually booked.
 *
 * Until now the booking data had nowhere to land: calls were logged, Cal.com
 * was written to, and the clinic had no screen showing what had been booked or
 * any way to undo it. This is that screen, backed by the `appointments` table
 * (supabase/schema.sql) both booking paths write to.
 *
 * Cancelling goes through /api/appointments/cancel, which cancels on Cal.com
 * before touching our row — so what this page shows matches the real calendar.
 */
export default function AppointmentsPage() {
  const { lang } = useLang();
  const { demo } = useSession();
  const live = isSupabaseConfigured && !demo;

  // null = still loading. Deliberately not seeded with demo rows: showing
  // invented appointments for a second and then swapping them for the real
  // (possibly empty) list is how a clinic misreads its own schedule.
  const [rows, setRows] = useState<Appointment[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [isDemoData, setIsDemoData] = useState(false);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  // "Now" is genuinely time-dependent, so it is captured once when the list
  // loads rather than read during render — reading the clock while rendering
  // is impure and would also differ between the server and client passes.
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (live) {
        const [appointments, loadedAgents] = await Promise.all([fetchAppointments(), fetchAgents()]);
        if (!alive) return;
        if (loadedAgents?.length) setAgents(loadedAgents);
        if (appointments) {
          setRows(appointments);
          setIsDemoData(false);
          setNow(Date.now());
          return;
        }
      }
      if (!alive) return;
      setRows(demoAppointments() as Appointment[]);
      setIsDemoData(true);
      setNow(Date.now());
    })();

    return () => {
      alive = false;
    };
  }, [live]);

  const L = {
    title: lang === "tr" ? "Randevular" : "Appointments",
    sub: lang === "tr" ? "Ajanın aldığı randevular — takvimdekiyle birebir." : "What the agent booked — mirrored from the calendar.",
    upcoming: lang === "tr" ? "Yaklaşan" : "Upcoming",
    past: lang === "tr" ? "Geçmiş" : "Past",
    cancelled: lang === "tr" ? "İptal" : "Cancelled",
    all: lang === "tr" ? "Tümü" : "All",
    empty: lang === "tr" ? "Bu filtrede randevu yok." : "No appointments in this filter.",
    loading: lang === "tr" ? "Yükleniyor…" : "Loading…",
    demoBadge: lang === "tr" ? "Demo verisi" : "Demo data",
    patient: lang === "tr" ? "Hasta" : "Patient",
    when: lang === "tr" ? "Tarih" : "When",
    agent: lang === "tr" ? "Ajan" : "Agent",
    status: lang === "tr" ? "Durum" : "Status",
    phone: lang === "tr" ? "Telefon" : "Phone",
    email: lang === "tr" ? "E-posta" : "Email",
    bookedVia: lang === "tr" ? "Nasıl alındı" : "Booked via",
    inCall: lang === "tr" ? "Görüşme sırasında" : "During the call",
    postCall: lang === "tr" ? "Görüşme sonrası" : "After the call",
    calendarRef: lang === "tr" ? "Takvim kaydı" : "Calendar ref",
    callRef: lang === "tr" ? "Arama kaydı" : "Call ref",
    cancel: lang === "tr" ? "Randevuyu iptal et" : "Cancel appointment",
    cancelling: lang === "tr" ? "İptal ediliyor…" : "Cancelling…",
    cancelledOn: lang === "tr" ? "İptal edildi" : "Cancelled",
    demoCancelHint: lang === "tr" ? "Demo modda iptal ve erteleme yapılamaz." : "Cancelling and rescheduling are disabled in demo mode.",
    booked: lang === "tr" ? "Onaylı" : "Booked",
    close: lang === "tr" ? "Kapat" : "Close",
    reschedule: lang === "tr" ? "Ertele" : "Reschedule",
    rescheduling: lang === "tr" ? "Erteleniyor…" : "Rescheduling…",
    pickNewTime: lang === "tr" ? "Yeni bir saat seçin" : "Pick a new time",
    loadingSlots: lang === "tr" ? "Uygun saatler yükleniyor…" : "Loading open slots…",
    noSlots: lang === "tr" ? "Önümüzdeki 7 gün için boş yer görünmüyor." : "No openings in the next 7 days.",
    dismiss: lang === "tr" ? "Vazgeç" : "Cancel",
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    const list = rows.filter((r) => {
      const starts = Date.parse(r.startsAt);
      if (filter === "cancelled") return r.status === "cancelled";
      if (filter === "upcoming") return r.status === "booked" && starts >= now;
      if (filter === "past") return r.status === "booked" && starts < now;
      return true;
    });
    // Upcoming reads soonest-first; everything else reads most-recent-first.
    return filter === "upcoming" ? list : [...list].reverse();
  }, [rows, filter, now]);

  const agentName = (id: string | null) => agents.find((a) => a.id === id)?.name ?? "—";

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
      day: "numeric",
      month: "short",
      weekday: "short",
    }).format(new Date(iso));

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  const open = rows?.find((r) => r.id === openId) ?? null;

  // Opening a row or closing the drawer must not leave a stale "pick a new
  // time" panel showing on whatever appointment comes next.
  const selectAppointment = (id: string | null) => {
    setOpenId(id);
    setRescheduling(false);
    setSlots(null);
    setSlotsError(null);
  };

  const handleCancel = async (appointment: Appointment) => {
    setError(null);
    if (isDemoData) {
      setError(L.demoCancelHint);
      return;
    }
    setBusyId(appointment.id);
    const result = await cancelAppointment(appointment.id);
    setBusyId(null);

    if (!result.ok) {
      setError(result.error ?? "İptal başarısız.");
      return;
    }
    setRows((list) =>
      (list ?? []).map((r) =>
        r.id === appointment.id ? { ...r, status: "cancelled", cancelledAt: new Date().toISOString() } : r,
      ),
    );
  };

  const startReschedule = async () => {
    setError(null);
    if (isDemoData) {
      setError(L.demoCancelHint);
      return;
    }
    setRescheduling(true);
    setSlotsError(null);
    if (slots === null) {
      const result = await fetchAvailableSlots();
      if (!result.ok) setSlotsError(result.error ?? "Uygun saatler alınamadı.");
      setSlots(result.slots);
    }
  };

  const handleReschedule = async (appointment: Appointment, slot: AvailableSlot) => {
    setError(null);
    setBusyId(appointment.id);
    const result = await rescheduleAppointment(appointment.id, slot.start);
    setBusyId(null);

    if (!result.ok) {
      setError(result.error ?? "Erteleme başarısız.");
      return;
    }
    setRows((list) =>
      (list ?? []).map((r) =>
        r.id === appointment.id
          ? { ...r, startsAt: result.startsAt ?? slot.start, bookingUid: result.bookingUid ?? r.bookingUid }
          : r,
      ),
    );
    setRescheduling(false);
    setSlots(null);
  };

  const counts = {
    upcoming: rows?.filter((r) => r.status === "booked" && Date.parse(r.startsAt) >= now).length ?? 0,
    past: rows?.filter((r) => r.status === "booked" && Date.parse(r.startsAt) < now).length ?? 0,
    cancelled: rows?.filter((r) => r.status === "cancelled").length ?? 0,
    all: rows?.length ?? 0,
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "upcoming", label: L.upcoming },
    { key: "past", label: L.past },
    { key: "cancelled", label: L.cancelled },
    { key: "all", label: L.all },
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[20px] font-bold tracking-tight">{L.title}</h1>
          <p className="text-[13px] text-muted-foreground">{L.sub}</p>
        </div>
        {isDemoData && (
          <span className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider" style={{ background: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
            {L.demoBadge}
          </span>
        )}
      </div>

      {/* filters — scrollable so six chips never overflow a narrow phone */}
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "shrink-0 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
              filter === f.key ? "border-violet/50 bg-violet-soft text-violet" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label} <span className="tabular-nums opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-md border px-3 py-2 text-[12px]" style={{ borderColor: "color-mix(in oklch, var(--color-destructive) 40%, transparent)", color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border bg-card/30">
        {/* desktop column headers */}
        <div className="hidden border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-[150px_1fr_130px_110px_28px] md:gap-3">
          <span>{L.when}</span>
          <span>{L.patient}</span>
          <span>{L.agent}</span>
          <span>{L.status}</span>
          <span />
        </div>

        {rows === null ? (
          <p className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">{L.loading}</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">{L.empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => {
              const cancelled = r.status === "cancelled";
              return (
                <li key={r.id}>
                  <button
                    onClick={() => selectAppointment(r.id)}
                    className="grid w-full grid-cols-1 gap-1 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 md:grid-cols-[150px_1fr_130px_110px_28px] md:items-center md:gap-3"
                  >
                    <span className="font-mono text-[11.5px] tabular-nums">
                      <span className={cn(cancelled && "line-through opacity-60")}>{fmtDate(r.startsAt)}</span>{" "}
                      <span className={cn("font-semibold", cancelled && "line-through opacity-60")}>{fmtTime(r.startsAt)}</span>
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold leading-tight">{r.attendeeName}</span>
                      <span className="block truncate font-mono text-[10.5px] text-muted-foreground md:hidden">
                        {r.attendeePhone ?? "—"} · {agentName(r.agentId)}
                      </span>
                      <span className="hidden truncate font-mono text-[10.5px] text-muted-foreground md:block">
                        {r.attendeePhone ?? "—"}
                      </span>
                    </span>

                    <span className="hidden truncate font-mono text-[11px] text-muted-foreground md:block">
                      {agentName(r.agentId)}
                    </span>

                    <span
                      className="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider"
                      style={{
                        color: cancelled ? "var(--color-missed)" : "var(--color-booked)",
                        background: cancelled
                          ? "color-mix(in oklch, var(--color-missed) 14%, transparent)"
                          : "color-mix(in oklch, var(--color-booked) 14%, transparent)",
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cancelled ? "var(--color-missed)" : "var(--color-booked)" }} />
                      {cancelled ? L.cancelledOn : L.booked}
                    </span>

                    <Icon name="chevron-right" className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* detail drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm" onClick={() => selectAppointment(null)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={L.title}
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-4"
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[16px] font-bold">{open.attendeeName}</h2>
                <p className="font-mono text-[12px] text-muted-foreground">
                  {fmtDate(open.startsAt)} · {fmtTime(open.startsAt)}
                </p>
              </div>
              <button onClick={() => selectAppointment(null)} aria-label={L.close} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </header>

            <dl className="mt-4 space-y-2.5">
              {[
                { k: L.phone, v: open.attendeePhone ?? "—" },
                { k: L.email, v: open.attendeeEmail ?? "—" },
                { k: L.agent, v: agentName(open.agentId) },
                { k: L.bookedVia, v: open.source === "in-call" ? L.inCall : L.postCall },
                { k: L.calendarRef, v: open.bookingUid },
                { k: L.callRef, v: open.callId },
              ].map((row) => (
                <div key={row.k} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{row.k}</dt>
                  <dd className="truncate font-mono text-[11.5px]">{row.v}</dd>
                </div>
              ))}
            </dl>

            {open.status === "cancelled" ? (
              <p className="mt-4 rounded-md border border-border px-3 py-2 text-[12px] text-muted-foreground">
                {L.cancelledOn}
                {open.cancelledAt ? ` · ${fmtDate(open.cancelledAt)} ${fmtTime(open.cancelledAt)}` : ""}
              </p>
            ) : rescheduling ? (
              <div className="mt-4 rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{L.pickNewTime}</p>
                  <button
                    onClick={() => setRescheduling(false)}
                    className="font-mono text-[10.5px] text-muted-foreground hover:text-foreground"
                  >
                    {L.dismiss}
                  </button>
                </div>

                {slots === null ? (
                  <p className="py-3 text-center text-[12px] text-muted-foreground">{L.loadingSlots}</p>
                ) : slotsError ? (
                  <p className="text-[12px]" style={{ color: "var(--color-destructive)" }}>{slotsError}</p>
                ) : slots.length === 0 ? (
                  <p className="py-3 text-center text-[12px] text-muted-foreground">{L.noSlots}</p>
                ) : (
                  <ul className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto">
                    {slots.map((slot) => (
                      <li key={slot.start}>
                        <button
                          onClick={() => handleReschedule(open, slot)}
                          disabled={busyId === open.id}
                          className="w-full rounded-md border border-border px-2 py-1.5 text-left font-mono text-[11px] transition-colors hover:border-violet/50 hover:bg-violet-soft hover:text-violet disabled:opacity-50"
                        >
                          {slot.spoken}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={startReschedule}
                  disabled={busyId === open.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:border-violet/50 hover:text-violet disabled:opacity-50"
                >
                  <Icon name="calendar-clock" className="h-3.5 w-3.5" />
                  {L.reschedule}
                </button>
                <button
                  onClick={() => handleCancel(open)}
                  disabled={busyId === open.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-50"
                  style={{ borderColor: "color-mix(in oklch, var(--color-destructive) 45%, transparent)", color: "var(--color-destructive)" }}
                >
                  <Icon name="calendar-x" className="h-3.5 w-3.5" />
                  {busyId === open.id ? L.cancelling : L.cancel}
                </button>
              </div>
            )}
            {isDemoData && open.status !== "cancelled" && (
              <p className="mt-2 text-[11px] text-muted-foreground">{L.demoCancelHint}</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
