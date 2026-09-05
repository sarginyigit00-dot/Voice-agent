"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useLang } from "@/components/i18n/language-provider";
import { useSession } from "@/components/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { CrmRecord } from "@/lib/crm/types";
import { CONTACT_STATUS, groupCallsIntoContacts, type CrmContact } from "@/lib/crm/contacts";
import { OUTCOME_TINT, type Outcome } from "@/lib/demo/data";
import { normalizePhone } from "@/lib/crm/phone";
import { authedFetch } from "@/lib/supabase/authed-fetch";
import { demoCrmRecords } from "@/lib/demo/crm";
import { ContactDrawer, avatarInitials, formatDuration } from "./contact-drawer";
import type { Lang } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export default function CrmPage() {
  const { lang } = useLang();
  const { demo } = useSession();
  const [fetched, setFetched] = useState<CrmRecord[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<CrmContact | null>(null);

  // Same gate /calls uses: the demo bypass stays fully local, and without
  // Supabase configured there's nothing to fetch in the first place.
  const live = isSupabaseConfigured && !demo;

  useEffect(() => {
    if (!live) return;
    let alive = true;
    authedFetch("/api/crm?limit=500")
      .then((r) => r.json())
      .then((body) => alive && setFetched(body.records ?? []))
      .catch(() => alive && setFetched([]));
    return () => {
      alive = false;
    };
  }, [live]);

  const demoRecords = useMemo(() => demoCrmRecords(lang), [lang]);

  // A real account never borrows the demo book, not even when its own table
  // is still empty — sample contacts under a real login read as that clinic's
  // actual patients. The empty state (L.emptyNoData) explains the page instead.
  const isDemo = !live;
  const records = !live ? demoRecords : fetched;

  const contacts = useMemo(() => groupCallsIntoContacts(records ?? []), [records]);

  const rows = useMemo(() => {
    if (!query.trim()) return contacts;
    const q = query.toLowerCase();
    const digits = normalizePhone(query);
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || (digits && normalizePhone(c.number).includes(digits)),
    );
  }, [contacts, query]);

  const stats = useMemo(() => {
    const calls = contacts.reduce((n, c) => n + c.callCount, 0);
    const repeat = contacts.filter((c) => c.callCount > 1).length;
    const booked = contacts.filter((c) => c.status === "booked").length;
    const totalSec = contacts.reduce((n, c) => n + c.calls.reduce((s, r) => s + (r.duration_sec || 0), 0), 0);
    return {
      contacts: contacts.length,
      repeat,
      booked,
      avgSec: calls ? Math.round(totalSec / calls) : 0,
    };
  }, [contacts]);

  const L = {
    title: "CRM",
    sub: lang === "tr"
      ? "Sizi arayan herkes, tüm geçmişiyle tek satırda."
      : "Everyone who called you, each with their whole history in one row.",
    demoBadge: lang === "tr" ? "Demo verisi" : "Demo data",
    demoHint: lang === "tr"
      ? "İlk gerçek aramalarınız geldiğinde bu defter otomatik olarak onlarla dolar."
      : "This book fills with your real calls as soon as the first ones come in.",
    search: lang === "tr" ? "İsim veya numara ara…" : "Search name or number…",
    kpiContacts: lang === "tr" ? "Kişi" : "Contacts",
    kpiRepeat: lang === "tr" ? "Tekrar arayan" : "Repeat callers",
    kpiBooked: lang === "tr" ? "Randevulu" : "Booked",
    kpiAvg: lang === "tr" ? "Ort. görüşme" : "Avg. call",
    caller: lang === "tr" ? "Arayan" : "Caller",
    callCount: lang === "tr" ? "Arama" : "Calls",
    lastContact: lang === "tr" ? "Son temas" : "Last contact",
    status: lang === "tr" ? "Durum" : "Status",
    nextStep: lang === "tr" ? "Sonraki adım" : "Next step",
    loading: lang === "tr" ? "Yükleniyor…" : "Loading…",
    emptyFiltered: lang === "tr" ? "Eşleşen kişi yok." : "No matching contacts.",
    emptyNoData: lang === "tr"
      ? "Henüz kayıt yok. Bir ajanda \"CRM'e kaydet\" açıldığında arayanlar burada birikmeye başlar."
      : "No records yet. Turn on \"Log to CRM\" for an agent and callers will start showing up here.",
    drawer: {
      transcript: lang === "tr" ? "Transkript" : "Transcript",
      close: lang === "tr" ? "Kapat" : "Close",
      calls: lang === "tr" ? "arama" : "calls",
      lastContact: lang === "tr" ? "son temas" : "last contact",
      nextStep: lang === "tr" ? "Sonraki adım" : "Next step",
      noTranscript: lang === "tr" ? "Bu arama için transkript yok." : "No transcript for this call.",
    },
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[20px] font-bold tracking-tight">{L.title}</h1>
            {isDemo && records !== null && (
              <span className="rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-warning-foreground">
                {L.demoBadge}
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground">{isDemo ? L.demoHint : L.sub}</p>
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

      {contacts.length > 0 && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label={L.kpiContacts} value={String(stats.contacts)} />
          <StatTile label={L.kpiRepeat} value={String(stats.repeat)} />
          <StatTile label={L.kpiBooked} value={String(stats.booked)} accent />
          <StatTile label={L.kpiAvg} value={formatDuration(stats.avgSec)} />
        </section>
      )}

      <section className="rounded-lg border border-border bg-card/30">
        <div className="hidden grid-cols-[1.7fr_0.5fr_0.9fr_0.8fr_1.6fr] gap-2 border-b border-border px-3 py-2 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground md:grid">
          <span>{L.caller}</span>
          <span>{L.callCount}</span>
          <span>{L.lastContact}</span>
          <span>{L.status}</span>
          <span>{L.nextStep}</span>
        </div>

        {records === null ? (
          <div className="grid place-items-center py-16 text-[13px] text-muted-foreground">{L.loading}</div>
        ) : rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center text-[13px] text-muted-foreground">
            {contacts.length === 0 ? L.emptyNoData : L.emptyFiltered}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((c) => (
              <li key={c.key}>
                <button
                  onClick={() => setOpen(c)}
                  className="grid w-full grid-cols-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-card/70 md:grid-cols-[1.7fr_0.5fr_0.9fr_0.8fr_1.6fr]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-soft font-mono text-[10px] font-bold text-violet">
                      {avatarInitials(c.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium leading-tight">{c.name}</p>
                      <p className="truncate font-mono text-[10.5px] text-muted-foreground">{c.number || "—"}</p>
                    </div>
                  </div>

                  <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                    {c.callCount}
                    {c.callCount > 1 && <span className="ml-1 text-violet">•</span>}
                  </span>

                  <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                    {relativeTime(c.lastContactAt, lang)}
                  </span>

                  <StatusPill contact={c} lang={lang} />

                  <span className="truncate text-[12.5px] text-foreground/80">
                    {c.nextStep || <span className="text-muted-foreground/50">—</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {open && <ContactDrawer contact={open} onClose={() => setOpen(null)} lang={lang} labels={L.drawer} />}
    </div>
  );
}

/**
 * A contact's state, worded for a person ("Randevulu") rather than for a
 * single call ("Randevu"), but borrowing OUTCOME_TINT so it reads with the
 * same colour language as the call pills on /calls and in the drawer.
 */
function StatusPill({ contact, lang }: { contact: CrmContact; lang: Lang }) {
  const outcome = contact.status === "followup" ? contact.calls[0].outcome : contact.status;
  const tint = outcome in OUTCOME_TINT ? OUTCOME_TINT[outcome as Outcome] : "var(--color-muted-foreground)";

  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold"
      style={{ color: tint, background: `color-mix(in oklch, ${tint} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tint }} />
      {CONTACT_STATUS[contact.status][lang]}
    </span>
  );
}

function relativeTime(iso: string, lang: Lang): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  const tr = lang === "tr";

  if (diffMin < 1) return tr ? "az önce" : "just now";
  if (diffMin < 60) return tr ? `${diffMin} dk önce` : `${diffMin}m ago`;

  const h = Math.floor(diffMin / 60);
  if (h < 24) return tr ? `${h} saat önce` : `${h}h ago`;

  const d = Math.floor(h / 24);
  if (d === 1) return tr ? "dün" : "yesterday";
  if (d < 7) return tr ? `${d} gün önce` : `${d}d ago`;

  return new Date(iso).toLocaleDateString(tr ? "tr-TR" : "en-US", { day: "2-digit", month: "short" });
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card/30 px-3 py-2.5">
      <p className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-mono text-[22px] font-bold tabular-nums leading-none", accent && "text-violet")}>
        {value}
      </p>
    </div>
  );
}
