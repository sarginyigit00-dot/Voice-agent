"use client";

import type { ActivityUser, AdminActivity } from "@/lib/admin/queries";

/** How many people a list box shows before collapsing the rest into "+N". */
const LIST_LIMIT = 8;

/**
 * /admin → Özet: four boxes on panel usage. Activity comes from usage_events
 * (app/api/usage), so it only covers the days since tracking started — the
 * boxes say so instead of showing a misleading zero.
 */
export function OverviewTab({ activity, totalUsers }: { activity: AdminActivity; totalUsers: number }) {
  const { tracking, since, activeUsers, topFeatures, inactive, newThisWeek } = activity;
  const collecting = !tracking && (
    <p className="text-xs text-muted-foreground">Veri toplanıyor — ilk kullanım kaydı bekleniyor.</p>
  );
  const maxHits = topFeatures[0]?.hits ?? 0;

  return (
    <div className="mt-3 space-y-2">
      {tracking && since && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Kullanım takibi {formatDay(since)} tarihinden beri
        </p>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        <Box title="Aktif kullanıcı · son 7 gün">
          {collecting || (
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {activeUsers}
              <span className="ml-1 text-base font-normal text-muted-foreground">/ {totalUsers}</span>
            </p>
          )}
        </Box>

        <Box title="En çok kullanılan özellikler · son 7 gün">
          {collecting ||
            (topFeatures.length === 0 ? (
              <p className="text-xs text-muted-foreground">Son 7 günde kullanım yok.</p>
            ) : (
              <ol className="space-y-2">
                {topFeatures.map((f) => (
                  <li key={f.label}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{f.label}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {f.hits} açılış · {f.users} kişi
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-muted">
                      <div
                        className="h-1 rounded-full bg-foreground/70"
                        style={{ width: `${maxHits ? (f.hits / maxHits) * 100 : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            ))}
        </Box>

        <Box title="7 gündür girmeyen" count={inactive.length}>
          <PeopleList people={inactive} empty="Herkes son 7 günde girdi." detail={(p) => lastSeen(p.lastSeenAt)} />
        </Box>

        <Box title="Bu hafta kaydolan" count={newThisWeek.length}>
          <PeopleList people={newThisWeek} empty="Bu hafta yeni kayıt yok." detail={(p) => formatDay(p.createdAt)} />
        </Box>
      </div>
    </div>
  );
}

function Box({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card/30 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{title}</h2>
        {count !== undefined && <span className="font-mono text-2xl font-semibold tabular-nums">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function PeopleList({
  people,
  empty,
  detail,
}: {
  people: ActivityUser[];
  empty: string;
  detail: (p: ActivityUser) => string;
}) {
  if (people.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border text-sm">
      {people.slice(0, LIST_LIMIT).map((p) => (
        <li key={p.id} className="flex items-baseline justify-between gap-2 py-1.5">
          <span className="min-w-0 truncate">
            {p.email ?? "—"}
            {p.clinicName && <span className="text-muted-foreground"> · {p.clinicName}</span>}
          </span>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{detail(p)}</span>
        </li>
      ))}
      {people.length > LIST_LIMIT && (
        <li className="py-1.5 text-xs text-muted-foreground">+{people.length - LIST_LIMIT} kişi daha</li>
      )}
    </ul>
  );
}

function lastSeen(iso: string | null): string {
  return iso ? formatDay(iso) : "hiç girmedi";
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
