"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemoRequest } from "@/lib/admin/queries";
import { TRIAL_CALLS_PER_DAY, TRIAL_DAYS, TRIAL_MAX_CALLS } from "@/lib/demo/trial-limits";
import { ActionButton, EmptyRow } from "./controls";

/**
 * /admin → Denemeler: a prospective clinic's own 14-day web trial
 * (/dene/<code>, lib/demo/trials.ts). The operator types the clinic's facts
 * as plain lines; creating the trial provisions its Vapi assistant, and the
 * link goes to the clinic by WhatsApp or email.
 */

interface TrialRow {
  id: string;
  code: string;
  clinicName: string;
  demoRequestId: string | null;
  vapiAssistantId: string | null;
  maxCalls: number;
  expiresAt: string;
  createdAt: string;
  source: "admin" | "self";
  email: string | null;
  used: number;
  status: { active: boolean; reason: "ok" | "expired" | "used_up"; callsLeft: number; daysLeft: number };
}

export interface TrialPrefill {
  clinicName: string;
  demoRequestId: string;
}

const FIELD =
  "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:outline-none";

export function TrialsTab({
  demoRequests,
  connected,
  prefill,
  onAct,
}: {
  demoRequests: DemoRequest[];
  connected: boolean;
  prefill: TrialPrefill | null;
  onAct: (body: unknown) => Promise<{ ok?: boolean; code?: string }>;
}) {
  const [trials, setTrials] = useState<TrialRow[] | null>(null);
  const [form, setForm] = useState({
    clinicName: prefill?.clinicName ?? "",
    demoRequestId: prefill?.demoRequestId ?? "",
    services: "",
    doctors: "",
    address: "",
    faq: "",
  });
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/demo-trials")
      .then((r) => r.json())
      .then((d: { trials?: TrialRow[] }) => setTrials(d.trials ?? []))
      .catch(() => setTrials([]));
  }, []);
  useEffect(load, [load]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await onAct({ action: "create", ...form });
    setBusy(false);
    if (res.ok) {
      setForm({ clinicName: "", demoRequestId: "", services: "", doctors: "", address: "", faq: "" });
      load();
    }
  }

  async function remove(id: string) {
    setBusy(true);
    await onAct({ action: "delete", id });
    setBusy(false);
    setConfirmId(null);
    load();
  }

  const link = (code: string) => `${window.location.origin}/dene/${code}`;
  async function copy(code: string) {
    await navigator.clipboard.writeText(link(code)).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mt-3 flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-card/30">
        <header className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">Yeni deneme</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {TRIAL_DAYS} gün, {TRIAL_MAX_CALLS} arama (günde en fazla {TRIAL_CALLS_PER_DAY}, her biri en fazla 3 dk). Numara gerekmez; klinik
            linkten tarayıcıyla arar. Randevular takvime yazılmaz.
          </p>
        </header>
        <form onSubmit={create} className="grid gap-3 p-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            Klinik adı (asistan bu adla açılır)
            <input required minLength={2} maxLength={80} value={form.clinicName} onChange={set("clinicName")} className={FIELD} placeholder="Gülüş Diş Kliniği" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Demo talebi (isteğe bağlı)
            <select value={form.demoRequestId} onChange={set("demoRequestId")} className={FIELD}>
              <option value="">—</option>
              {demoRequests.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.clinicName} · {d.contactName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            Hizmetler — her satıra bir tane: <span className="font-mono">Ad | fiyat TL | süre dk | açıklama</span> (fiyat boşsa muayeneden sonra söylenir)
            <textarea rows={5} value={form.services} onChange={set("services")} className={`${FIELD} font-mono text-xs`} placeholder={"Diş taşı temizliği | 1500 | 30\nİmplant | | 60 | Fiyat muayeneden sonra belirlenir\nDiş beyazlatma | 3500 | 45"} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Hekimler — her satıra bir: <span className="font-mono">Dt. Ad Soyad | uzmanlık</span>
            <textarea rows={3} value={form.doctors} onChange={set("doctors")} className={`${FIELD} font-mono text-xs`} placeholder={"Dt. Ayşe Yılmaz | Ortodonti"} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Adres
            <textarea rows={3} maxLength={500} value={form.address} onChange={set("address")} className={FIELD} placeholder="Mahalle, cadde, no, ilçe / il" />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            Sık sorulanlar / ek bilgi (çalışma saatleri, otopark, ödeme…)
            <textarea rows={3} maxLength={4000} value={form.faq} onChange={set("faq")} className={FIELD} />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <ActionButton type="submit" disabled={busy || !connected}>
              {busy ? "Oluşturuluyor…" : "Denemeyi oluştur"}
            </ActionButton>
            <span className="text-xs text-muted-foreground">Asistan Vapi&apos;de kurulur; birkaç saniye sürer.</span>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card/30">
        <header className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">Denemeler</h2>
        </header>
        {!trials ? (
          <EmptyRow text="Yükleniyor…" />
        ) : trials.length === 0 ? (
          <EmptyRow text={connected ? "Henüz deneme yok." : "Veri yok."} />
        ) : (
          <ul className="divide-y divide-border/60">
            {trials.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5 text-sm">
                <span className="min-w-[160px] flex-1">
                  <span className="block font-medium">{t.clinicName}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">/dene/{t.code}</span>
                  {t.source === "self" && (
                    <span className="block text-[11px] text-muted-foreground">Kendi açtı · {t.email}</span>
                  )}
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {t.used}/{t.maxCalls} arama
                </span>
                <span className="text-xs">
                  {t.status.active ? (
                    <span className="text-foreground">{t.status.daysLeft} gün kaldı</span>
                  ) : (
                    <span className="text-muted-foreground">{t.status.reason === "expired" ? "süresi doldu" : "aramalar bitti"}</span>
                  )}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <ActionButton onClick={() => copy(t.code)}>{copied === t.code ? "Kopyalandı" : "Linki kopyala"}</ActionButton>
                  {confirmId === t.id ? (
                    <>
                      <span className="text-xs text-muted-foreground">Silinsin mi?</span>
                      <ActionButton destructive disabled={busy} onClick={() => remove(t.id)}>
                        Evet, sil
                      </ActionButton>
                      <ActionButton disabled={busy} onClick={() => setConfirmId(null)}>
                        Vazgeç
                      </ActionButton>
                    </>
                  ) : (
                    <ActionButton destructive disabled={busy} onClick={() => setConfirmId(t.id)}>
                      Sil
                    </ActionButton>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
