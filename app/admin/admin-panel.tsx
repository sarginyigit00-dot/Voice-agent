"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminAction } from "@/lib/admin/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/admin/constants";
import type { AdminOverview, AdminUser, WaitlistEntry } from "@/lib/admin/queries";
import type { EnvCheck, SystemHealth } from "@/lib/admin/health";

/**
 * Operator view over Randevox's own accounts and leads.
 *
 * Scope is deliberately limited to data we're the controller for — accounts
 * and waitlist sign-ups. No call transcripts, recordings, caller details or
 * appointment content: for those we're a processor acting on the clinic's
 * instructions (app/gizlilik/page.tsx §2), so they don't belong in an
 * operator console. See lib/admin/actions.ts for the full reasoning.
 *
 * Styled after the cockpit's panels (hairline sections, mono uppercase column
 * labels, tabular numbers) without importing its chrome — /admin lives outside
 * the (app) route group on purpose.
 */
export function AdminPanel({ data, health }: { data: AdminOverview; health: SystemHealth }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [tab, setTab] = useState<"users" | "waitlist" | "health">("users");
  const [flash, setFlash] = useState<{ ok: boolean; message: string } | null>(null);

  async function logout() {
    setLeaving(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  /** Shared POST helper for both tabs' write actions. */
  async function post(url: string, body: unknown) {
    setFlash(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      error?: string;
    };
    setFlash({
      ok: Boolean(parsed.ok),
      message: parsed.message ?? parsed.error ?? "İşlem başarısız.",
    });
    router.refresh();
  }

  const { totals, users, waitlist, connected } = data;
  // Badge on the Sistem tab: unreachable tables plus missing non-optional keys
  // that aren't already covered by an integration's own "not connected" row.
  const problems =
    health.tables.filter((t) => !t.ok).length +
    health.extras.filter((e) => !e.optional && !e.set).length;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Randevox · yönetim
          </p>
          <h1 className="mt-0.5 font-display text-[22px] font-bold tracking-tight">Yönetim paneli</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Kokpite git
          </Link>
          <button
            onClick={logout}
            disabled={leaving}
            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Çıkış
          </button>
        </div>
      </header>

      {!connected && (
        <p className="mt-5 rounded-lg border border-border bg-card/30 px-3 py-2.5 text-sm text-muted-foreground">
          Supabase bağlı değil — <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> ve{" "}
          <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> tanımlanınca gerçek
          veriler burada listelenir.
        </p>
      )}

      {flash && (
        <p
          className={cn(
            "mt-5 rounded-lg px-3 py-2 text-sm",
            flash.ok ? "bg-booked/10 text-booked" : "bg-missed/10 text-missed",
          )}
        >
          {flash.message}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Toplam kullanıcı" value={totals.users} />
        <Stat label="Bugün kaydolan" value={totals.newToday} />
        <Stat label="Doğrulanmamış" value={totals.unconfirmed} />
        <Stat label="Ön kayıt" value={waitlist.length} />
        <Stat label="Toplam randevu" value={totals.appointments} />
      </div>

      <div className="mt-4 flex items-center gap-1 border-b border-border">
        <Tab active={tab === "users"} onClick={() => setTab("users")}>
          Kullanıcılar
        </Tab>
        <Tab active={tab === "waitlist"} onClick={() => setTab("waitlist")}>
          Ön kayıt ({waitlist.length})
        </Tab>
        <Tab active={tab === "health"} onClick={() => setTab("health")}>
          Sistem {problems > 0 && <span className="text-missed">({problems})</span>}
        </Tab>
      </div>

      {tab === "users" && (
        <UsersTab
          users={users}
          connected={connected}
          onAct={(action, userId, password) =>
            post("/api/admin/users", { action, userId, password })
          }
        />
      )}
      {tab === "waitlist" && (
        <WaitlistTab
          entries={waitlist}
          connected={connected}
          onDelete={(id) => post("/api/admin/waitlist", { action: "delete", id })}
        />
      )}
      {tab === "health" && <HealthTab health={health} />}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Bu panel yalnızca hesap ve ön kayıt bilgilerini gösterir. Kliniklerin çağrı kayıtları,
        transkriptleri ve arayan bilgileri — gizlilik politikasının 2. maddesi gereği veri işleyen
        sıfatıyla tuttuğumuz veriler — buradan görüntülenmez.
      </p>
    </div>
  );
}

/* ── Users ──────────────────────────────────────────────────────────────── */

function UsersTab({
  users,
  connected,
  onAct,
}: {
  users: AdminUser[];
  connected: boolean;
  onAct: (action: AdminAction, userId: string, password?: string) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function act(action: AdminAction, userId: string, password?: string) {
    setBusy(userId);
    await onAct(action, userId, password);
    setBusy(null);
    setOpenId(null);
  }

  const needle = query.trim().toLocaleLowerCase("tr");
  const shown = needle
    ? users.filter((u) =>
        `${u.email ?? ""} ${u.fullName ?? ""}`.toLocaleLowerCase("tr").includes(needle),
      )
    : users;

  return (
    <section className="mt-3 rounded-lg border border-border bg-card/30">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">Kullanıcılar</h2>
        <SearchInput value={query} onChange={setQuery} placeholder="E-posta veya ad ara…" />
      </header>

      <div className="hidden grid-cols-[1.6fr_1fr_0.8fr_0.8fr_auto] gap-2 border-b border-border/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:grid">
        <span>E-posta</span>
        <span>Ad soyad</span>
        <span>Kayıt</span>
        <span>Son giriş</span>
        <span className="w-14" />
      </div>

      {shown.length === 0 ? (
        <EmptyRow
          text={
            users.length === 0
              ? connected
                ? "Henüz kayıtlı kullanıcı yok."
                : "Veri yok."
              : "Aramaya uyan kullanıcı yok."
          }
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {shown.map((u) => (
            <li key={u.id}>
              <div className="grid grid-cols-1 gap-1 px-3 py-2.5 text-sm sm:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_auto] sm:items-center sm:gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn("truncate", u.banned && "line-through opacity-60")}>
                    {u.email ?? "—"}
                  </span>
                  {u.banned && (
                    <Badge tone="destructive" className="shrink-0 text-[10px]">
                      askıda
                    </Badge>
                  )}
                  {!u.confirmed && !u.banned && (
                    <Badge tone="warning" className="shrink-0 text-[10px]">
                      doğrulanmamış
                    </Badge>
                  )}
                </span>
                <span className="truncate text-muted-foreground">{u.fullName ?? "—"}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDate(u.createdAt)}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {u.lastSignInAt ? formatDate(u.lastSignInAt) : "—"}
                </span>
                <button
                  onClick={() => setOpenId(openId === u.id ? null : u.id)}
                  className="w-14 cursor-pointer rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {openId === u.id ? "Kapat" : "Yönet"}
                </button>
              </div>

              {openId === u.id && <UserActions user={u} busy={busy === u.id} onAct={act} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Inline action bar under a row. Delete is two-step; nothing uses confirm(). */
function UserActions({
  user,
  busy,
  onAct,
}: {
  user: AdminUser;
  busy: boolean;
  onAct: (action: AdminAction, userId: string, password?: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/40 px-3 py-2.5">
      {!user.confirmed && (
        <ActionButton disabled={busy} onClick={() => onAct("confirm", user.id)}>
          E-postayı doğrula
        </ActionButton>
      )}

      <ActionButton disabled={busy} onClick={() => setSettingPassword((open) => !open)}>
        Şifre belirle
      </ActionButton>

      {user.banned ? (
        <ActionButton disabled={busy} onClick={() => onAct("unban", user.id)}>
          Askıyı kaldır
        </ActionButton>
      ) : (
        <ActionButton disabled={busy} onClick={() => onAct("ban", user.id)}>
          Hesabı askıya al
        </ActionButton>
      )}

      <ConfirmDelete
        open={confirmDelete}
        busy={busy}
        label="Hesabı sil"
        question="Kalıcı olarak silinsin mi?"
        onOpen={() => setConfirmDelete(true)}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => onAct("delete", user.id)}
      />

      {settingPassword && (
        <SetPasswordForm
          busy={busy}
          onCancel={() => setSettingPassword(false)}
          onSubmit={(password) => onAct("setPassword", user.id, password)}
        />
      )}
    </div>
  );
}

/**
 * Two stacked fields that must match before anything is sent — the operator is
 * typing a password they can't see, for someone else, so a typo would lock the
 * customer out with no way to discover what was actually saved.
 *
 * Lives on its own row: `w-full` makes the parent's flex-wrap break here.
 */
function SetPasswordForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (first.length < MIN_PASSWORD_LENGTH) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
      return;
    }
    if (first !== second) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setError(null);
    onSubmit(first);
  }

  return (
    <form
      className="w-full space-y-2 border-t border-border/60 pt-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-2 sm:max-w-[260px]">
        <PasswordInput value={first} onChange={setFirst} placeholder="Yeni şifre" />
        <PasswordInput value={second} onChange={setSecond} placeholder="Yeni şifre (tekrar)" />
      </div>

      {error && <p className="text-[11px] text-missed">{error}</p>}

      <div className="flex items-center gap-2">
        <ActionButton type="submit" disabled={busy}>
          Kaydet
        </ActionButton>
        <ActionButton disabled={busy} onClick={onCancel}>
          Vazgeç
        </ActionButton>
        <span className="text-[11px] text-muted-foreground">
          Yeni şifreyi kullanıcıya kendin iletmen gerekir — e-posta gönderilmez.
        </span>
      </div>
    </form>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="new-password"
      className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none"
    />
  );
}

/* ── Waitlist ───────────────────────────────────────────────────────────── */

function WaitlistTab({
  entries,
  connected,
  onDelete,
}: {
  entries: WaitlistEntry[];
  connected: boolean;
  onDelete: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const needle = query.trim().toLocaleLowerCase("tr");
  const shown = needle
    ? entries.filter((e) => e.email.toLocaleLowerCase("tr").includes(needle))
    : entries;

  /** Exports what's on screen, so a filtered view exports the filtered list. */
  function exportCsv() {
    const rows = [
      ["email", "kayit_tarihi"],
      ...shown.map((e) => [e.email, e.createdAt]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    // ﻿ so Excel opens the Turkish characters as UTF-8 rather than ANSI.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `on-kayit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function remove(id: string) {
    setBusy(id);
    await onDelete(id);
    setBusy(null);
    setConfirmId(null);
  }

  return (
    <section className="mt-3 rounded-lg border border-border bg-card/30">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">Ön kayıt listesi</h2>
        <div className="flex items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="E-posta ara…" />
          <button
            onClick={exportCsv}
            disabled={shown.length === 0}
            className="shrink-0 cursor-pointer rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            CSV indir
          </button>
        </div>
      </header>

      <div className="hidden grid-cols-[2fr_0.8fr_auto] gap-2 border-b border-border/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:grid">
        <span>E-posta</span>
        <span>Tarih</span>
        <span className="w-28" />
      </div>

      {shown.length === 0 ? (
        <EmptyRow
          text={
            entries.length === 0
              ? connected
                ? "Henüz ön kayıt yok."
                : "Veri yok."
              : "Aramaya uyan kayıt yok."
          }
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {shown.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-1 gap-1 px-3 py-2.5 text-sm sm:grid-cols-[2fr_0.8fr_auto] sm:items-center sm:gap-2"
            >
              <span className="truncate">{e.email}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatDate(e.createdAt)}
              </span>
              <span className="flex justify-end">
                <ConfirmDelete
                  open={confirmId === e.id}
                  busy={busy === e.id}
                  label="Listeden çıkar"
                  question="Silinsin mi?"
                  onOpen={() => setConfirmId(e.id)}
                  onCancel={() => setConfirmId(null)}
                  onConfirm={() => remove(e.id)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── System health ──────────────────────────────────────────────────────── */

function HealthTab({ health }: { health: SystemHealth }) {
  const { integrations, extras, tables, runtime } = health;

  return (
    <div className="mt-3 space-y-3">
      <section className="rounded-lg border border-border bg-card/30">
        <header className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">Entegrasyonlar</h2>
        </header>
        <ul className="divide-y divide-border/60">
          {integrations.map((i) => (
            <li key={i.key} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{i.name}</span>
                <Badge tone={i.connected ? "success" : "warning"} className="text-[10px]">
                  {i.connected ? "bağlı" : "demo modda"}
                </Badge>
                <a
                  href={i.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                >
                  dokümanlar ↗
                </a>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.purpose}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {i.vars.map((v) => (
                  <KeyChip key={v.name} check={v} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card/30">
        <header className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">Diğer anahtarlar</h2>
        </header>
        <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
          {extras.map((v) => (
            <KeyChip key={v.name} check={v} />
          ))}
        </div>
        <p className="px-3 pb-2.5 text-[11px] text-muted-foreground">
          Sadece anahtarın tanımlı olup olmadığı gösterilir — değerler hiçbir zaman tarayıcıya
          gönderilmez.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card/30">
        <header className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">Veritabanı tabloları</h2>
        </header>
        <ul className="divide-y divide-border/60">
          {tables.map((t) => (
            <li key={t.name} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="font-mono text-xs">{t.name}</span>
              <Badge tone={t.ok ? "success" : "destructive"} className="text-[10px]">
                {t.ok ? "erişilebilir" : "hata"}
              </Badge>
              {t.error && (
                <span className="text-xs text-muted-foreground">{t.error}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card/30 px-3 py-2.5">
        <h2 className="text-sm font-semibold">Çalışma ortamı</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <Row label="Ortam" value={runtime.env} />
          <Row label="Uygulama adresi" value={runtime.appUrl ?? "—"} />
          <Row label="Randevu saat dilimi" value={runtime.timezone} />
          <Row label="Kontrol zamanı" value={new Date(runtime.checkedAt).toLocaleString("tr-TR")} />
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono tabular-nums">{value}</dd>
    </div>
  );
}

function KeyChip({ check }: { check: EnvCheck }) {
  const tone = check.set ? "text-booked" : check.optional ? "text-muted-foreground" : "text-missed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5 font-mono text-[10px]",
        tone,
      )}
      title={check.optional ? "opsiyonel" : "gerekli"}
    >
      {check.set ? "✓" : check.optional ? "○" : "✕"} {check.name}
    </span>
  );
}

/* ── Shared bits ────────────────────────────────────────────────────────── */

function ConfirmDelete({
  open,
  busy,
  label,
  question,
  onOpen,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  label: string;
  question: string;
  onOpen: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <span className="ml-auto flex items-center gap-2">
      {open ? (
        <>
          <span className="text-xs text-muted-foreground">{question}</span>
          <ActionButton disabled={busy} destructive onClick={onConfirm}>
            Evet, sil
          </ActionButton>
          <ActionButton disabled={busy} onClick={onCancel}>
            Vazgeç
          </ActionButton>
        </>
      ) : (
        <ActionButton disabled={busy} destructive onClick={onOpen}>
          {label}
        </ActionButton>
      )}
    </span>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "-mb-px cursor-pointer border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 w-full max-w-[220px] rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none"
    />
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-3 py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function ActionButton({
  children,
  onClick,
  disabled,
  destructive,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Defaults to "button" so instances inside a <form> don't submit it. */
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
        destructive
          ? "border-missed/30 text-missed hover:bg-missed/10"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-card/30 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
    </div>
  );
}

/** Quotes a CSV cell only when it has to — keeps plain emails unquoted. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
