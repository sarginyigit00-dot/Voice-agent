"use client";

import { useState } from "react";
import appConfig from "@/app.config";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BILLING_STATUSES,
  MIN_PASSWORD_LENGTH,
  OVERAGE_USD_PER_MIN,
  SETUP_FEE_USD,
  PLANS,
  type BillingStatus,
  type PlanId,
} from "@/lib/admin/constants";
import type { AdminClinic } from "@/lib/admin/clinics";
import type { AdminUser } from "@/lib/admin/queries";
import type { ContractTerms } from "@/lib/contracts/text";
import { ActionButton, EmptyRow, inputClass } from "./controls";

type Act = (body: Record<string, unknown>) => Promise<{ ok?: boolean; url?: string }>;

const PLAN_IDS = Object.keys(PLANS) as PlanId[];

/**
 * The turnkey setup console. One row per clinic: its package, this month's
 * usage against quota (what the invoice is cut from), whether its calendar is
 * connected and who works there. Expanding a row edits it.
 */
export function ClinicsTab({
  clinics,
  users,
  connected,
  supportReady,
  onAct,
}: {
  clinics: AdminClinic[];
  users: AdminUser[];
  connected: boolean;
  supportReady: boolean;
  onAct: Act;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    const result = await onAct(body);
    setBusy(false);
    return result;
  }

  return (
    <div className="mt-3 space-y-3">
      <NewClinicForm busy={busy || !connected} onCreate={(name, plan) => act({ action: "create", name, plan })} />

      <section className="rounded-lg border border-border bg-card/30">
        <header className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">Klinikler</h2>
        </header>

        <div className="hidden grid-cols-[1.4fr_0.7fr_1.2fr_0.7fr_0.5fr_auto] gap-2 border-b border-border/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:grid">
          <span>Klinik</span>
          <span>Paket</span>
          <span>Bu ay</span>
          <span>Takvim</span>
          <span>Üye</span>
          <span className="w-14" />
        </div>

        {clinics.length === 0 ? (
          <EmptyRow text={connected ? "Henüz klinik yok. Yukarıdan ilk kliniği oluştur." : "Veri yok."} />
        ) : (
          <ul className="divide-y divide-border/60">
            {clinics.map((c) => (
              <li key={c.id}>
                <div className="grid grid-cols-1 gap-1 px-3 py-2.5 text-sm sm:grid-cols-[1.4fr_0.7fr_1.2fr_0.7fr_0.5fr_auto] sm:items-center sm:gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("truncate font-medium", c.status === "suspended" && "opacity-60")}>
                      {c.name}
                    </span>
                    {c.status === "suspended" && (
                      <Badge tone="destructive" className="shrink-0 text-[10px]">
                        askıda
                      </Badge>
                    )}
                    <BillingBadge clinic={c} />
                  </span>
                  <span className="text-muted-foreground">{PLANS[c.plan].label}</span>
                  <Usage plan={c.plan} used={c.minutesThisMonth} quota={c.minutesQuota} calls={c.callsThisMonth} />
                  <span className={cn("text-xs", c.calendarConnected ? "text-booked" : "text-missed")}>
                    {c.calendarConnected ? "bağlı" : "bağlı değil"}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{c.members.length}</span>
                  <button
                    onClick={() => setOpenId(openId === c.id ? null : c.id)}
                    className="w-14 cursor-pointer rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {openId === c.id ? "Kapat" : "Yönet"}
                  </button>
                </div>

                {openId === c.id && (
                  <ClinicEditor clinic={c} users={users} busy={busy} supportReady={supportReady} act={act} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const usd = (n: number, digits = 0) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: 2 });

/**
 * Minutes used against the package, the overage, and this month's invoice
 * so far: package price + minutes past the quota. "≈" because a custom deal
 * may have its quota edited while the price stays the package's.
 */
function Usage({ plan, used, quota, calls }: { plan: PlanId; used: number; quota: number; calls: number }) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 100;
  const over = Math.max(0, used - quota);
  const price = PLANS[plan].priceUsd;
  const total = price + over * OVERAGE_USD_PER_MIN;
  return (
    <span className="min-w-0 space-y-1">
      <span className="flex items-baseline gap-1.5 font-mono text-xs tabular-nums">
        {used.toLocaleString("tr-TR")} / {quota.toLocaleString("tr-TR")} dk
        <span className="text-muted-foreground">· {calls} arama</span>
      </span>
      <span className="block h-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", over > 0 ? "bg-missed" : "bg-booked")}
          style={{ width: `${pct}%` }}
        />
      </span>
      {over > 0 && (
        <span className="block text-[11px] text-missed">+{over.toLocaleString("tr-TR")} dk aşım</span>
      )}
      <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
        Fatura ≈ {usd(total)} $
        {over > 0 && ` (paket ${usd(price)} $ + ${over.toLocaleString("tr-TR")} dk × ${usd(OVERAGE_USD_PER_MIN, 2)} $)`}
      </span>
    </span>
  );
}

function NewClinicForm({ busy, onCreate }: { busy: boolean; onCreate: (name: string, plan: PlanId) => void }) {
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<PlanId>("klinik");

  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/30 px-3 py-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate(name.trim(), plan);
        setName("");
      }}
    >
      <span className="text-sm font-semibold">Yeni klinik</span>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Klinik adı"
        className={cn(inputClass, "max-w-[240px]")}
      />
      <PlanSelect value={plan} onChange={setPlan} />
      <ActionButton type="submit" disabled={busy || !name.trim()}>
        Oluştur
      </ActionButton>
    </form>
  );
}

function PlanSelect({ value, onChange }: { value: PlanId; onChange: (p: PlanId) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as PlanId)} className={cn(inputClass, "w-auto")}>
      {PLAN_IDS.map((id) => (
        <option key={id} value={id}>
          {PLANS[id].label} · {PLANS[id].minutes.toLocaleString("tr-TR")} dk
        </option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** A section's body: its hint, then its controls. The title lives on the SectionRow above it. */
function Block({ hint, children }: { hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

type Group = "setup" | "account";

/**
 * "Yönet": three cards. Destek opens the clinic's panel straight away; Kurulum
 * and Hesap ve ödeme each open their own list of collapsed sections, one group
 * and one section at a time — so only one form is ever on screen.
 */
function ClinicEditor({
  clinic,
  users,
  busy,
  supportReady,
  act,
}: {
  clinic: AdminClinic;
  users: AdminUser[];
  busy: boolean;
  supportReady: boolean;
  act: Act;
}) {
  const [group, setGroup] = useState<Group | null>(null);
  const [section, setSection] = useState<string | null>(null);

  function pickGroup(g: Group) {
    setGroup(group === g ? null : g);
    setSection(null);
  }

  const inbound = clinic.agents.find((a) => a.id === clinic.phone?.inboundAgentId);
  const phoneOk = Boolean(clinic.vapiPhoneNumberId && !clinic.phone?.error && inbound);
  const callback = clinic.agents.find((a) => a.id === clinic.callbackAgentId);
  const billing = effectiveBilling(clinic);

  const setup: Section[] = [
    {
      id: "phone",
      title: "Telefon ve ajanlar",
      status: !clinic.vapiPhoneNumberId
        ? { text: "numara yok", ok: false }
        : inbound && phoneOk
          ? { text: `${clinic.phone?.number ?? "numara"} → ${inbound.name}`, ok: true }
          : { text: clinic.phone?.error ? "hata" : "ajana bağlı değil", ok: false },
      body: <PhoneForm clinic={clinic} busy={busy} act={act} />,
    },
    {
      id: "calendar",
      title: "Takvim (Cal.com)",
      status: { text: clinic.calendarConnected ? "bağlı" : "bağlı değil", ok: clinic.calendarConnected },
      body: <CalendarForm clinic={clinic} busy={busy} act={act} />,
    },
    {
      id: "callback",
      title: "Hızlı geri dönüş",
      status: { text: callback ? `açık (${callback.name})` : "kapalı" },
      body: <CallbackForm clinic={clinic} busy={busy} act={act} />,
    },
    {
      id: "contact",
      title: "İletişim ve mesajlar",
      status: { text: `hasta mesajları: ${MESSAGE_CHANNEL[clinic.messageChannel]}` },
      body: <ContactForm clinic={clinic} busy={busy} act={act} />,
    },
    {
      id: "members",
      title: "Kullanıcılar",
      status: { text: `${clinic.members.length} kullanıcı`, ok: clinic.members.length > 0 },
      body: <Members clinic={clinic} users={users} busy={busy} act={act} />,
    },
  ];

  const account: Section[] = [
    {
      id: "plan",
      title: "Paket ve durum",
      status: {
        text: `${PLANS[clinic.plan].label} · ${clinic.minutesQuota} dk${clinic.status === "suspended" ? " · askıda" : ""}`,
        ok: clinic.status === "suspended" ? false : undefined,
      },
      body: <PlanForm clinic={clinic} busy={busy} act={act} />,
    },
    {
      id: "billing",
      title: "Abonelik (Ruul)",
      status: { text: BILLING_STATUSES[billing].toLocaleLowerCase("tr-TR"), ok: billing === "active" },
      body: <BillingForm clinic={clinic} busy={busy} act={act} />,
    },
    {
      id: "contract",
      title: "Sözleşme",
      status: { text: CONTRACT_STATUS[clinic.contract.status], ok: clinic.contract.status === "accepted" },
      body: <ContractForm clinic={clinic} busy={busy} act={act} />,
    },
  ];

  const sections = group === "setup" ? setup : group === "account" ? account : null;

  return (
    <div className="space-y-3 border-t border-border/60 bg-muted/40 px-3 py-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <SupportCard clinic={clinic} busy={busy} supportReady={supportReady} act={act} />
        <GroupCard title="Kurulum" active={group === "setup"} onClick={() => pickGroup("setup")}>
          <Check ok={phoneOk}>Telefon</Check>
          <Check ok={clinic.calendarConnected}>Takvim</Check>
          <span>{clinic.members.length} kullanıcı</span>
        </GroupCard>
        <GroupCard title="Hesap ve ödeme" active={group === "account"} onClick={() => pickGroup("account")}>
          <span>{PLANS[clinic.plan].label}</span>
          <Check ok={billing === "active"}>Abonelik</Check>
          <Check ok={clinic.contract.status === "accepted"}>Sözleşme</Check>
        </GroupCard>
      </div>

      {sections && (
        <ul className="divide-y divide-border/60 rounded-lg border border-border bg-background">
          {sections.map((sec) => (
            <SectionRow
              key={sec.id}
              section={sec}
              open={section === sec.id}
              onToggle={() => setSection(section === sec.id ? null : sec.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface Section {
  id: string;
  title: string;
  /** ok: true = green, false = red, undefined = neutral. */
  status: { text: string; ok?: boolean };
  body: React.ReactNode;
}

const MESSAGE_CHANNEL = { off: "kapalı", sms: "SMS", whatsapp: "WhatsApp" } as const;

function GroupCard({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        "cursor-pointer rounded-lg border bg-background p-3 text-left transition-colors",
        active ? "border-foreground" : "border-border hover:border-foreground/40",
      )}
    >
      <span className="flex items-center justify-between text-sm font-semibold">
        {title}
        <span className="text-xs text-muted-foreground">{active ? "▴" : "▾"}</span>
      </span>
      <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">{children}</span>
    </button>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span>
      <span className={ok ? "text-booked" : "text-missed"}>{ok ? "✓" : "✗"}</span> {children}
    </span>
  );
}

function SectionRow({ section, open, onToggle }: { section: Section; open: boolean; onToggle: () => void }) {
  const { title, status, body } = section;
  return (
    <li>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40"
      >
        <span className="font-medium">{title}</span>
        <span
          className={cn(
            "ml-auto min-w-0 truncate text-xs",
            status.ok === true ? "text-booked" : status.ok === false ? "text-missed" : "text-muted-foreground",
          )}
        >
          {status.text}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="border-t border-border/60 px-3 py-3">{body}</div>}
    </li>
  );
}

/**
 * "Panelini aç": the clinic's own panel in a new tab, signed in as the support
 * account (lib/admin/support.ts). Full access, a "Destek modu" strip on top,
 * and every opening logged. The whole card is the button.
 */
function SupportCard({
  clinic,
  busy,
  supportReady,
  act,
}: {
  clinic: AdminClinic;
  busy: boolean;
  supportReady: boolean;
  act: Act;
}) {
  async function open() {
    // Opened inside the click, before the await — a tab opened after it is a popup the browser blocks.
    const tab = window.open("about:blank", "_blank");
    const result = await act({ action: "openPanel", clinicId: clinic.id });
    if (!tab) return;
    if (result.ok && result.url) {
      tab.opener = null;
      tab.location.href = result.url;
    } else {
      tab.close();
    }
  }

  const last = clinic.lastSupportAccess
    ? new Date(clinic.lastSupportAccess).toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  return (
    <button
      onClick={() => void open()}
      disabled={busy || !supportReady}
      title={'Kliniğin panelini yeni sekmede sahibi yetkisiyle açar. Panelde "Destek modu" şeridi görünür; her giriş kayda geçer.'}
      className="cursor-pointer rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex items-center justify-between text-sm font-semibold">
        Destek
        <span className="text-xs text-muted-foreground">↗</span>
      </span>
      <span className="mt-1.5 block text-xs text-muted-foreground">
        {!supportReady
          ? "SUPPORT_EMAIL ayarlı değil — .env.local'e ve Vercel'e ekle."
          : last
            ? `Panelini aç · son giriş ${last}`
            : "Panelini aç · henüz giriş yok"}
      </span>
    </button>
  );
}

/** Hesap ve ödeme → Paket ve durum. Sends only its own fields; the server patches what it gets. */
function PlanForm({ clinic, busy, act }: { clinic: AdminClinic; busy: boolean; act: Act }) {
  const [f, setF] = useState({
    name: clinic.name,
    plan: clinic.plan,
    minutesQuota: String(clinic.minutesQuota),
    status: clinic.status,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Block hint="Paketi değiştirmek kotayı değiştirmez; özel anlaşmalar için kotayı ayrıca yaz.">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ action: "update", clinicId: clinic.id, fields: f });
        }}
      >
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label="Klinik adı">
            <input value={f.name} onChange={set("name")} className={inputClass} />
          </Field>
          <Field label="Paket">
            <PlanSelect value={f.plan} onChange={(plan) => setF((prev) => ({ ...prev, plan }))} />
          </Field>
          <Field label="Aylık dakika kotası">
            <input value={f.minutesQuota} onChange={set("minutesQuota")} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label="Durum">
            <select value={f.status} onChange={set("status")} className={inputClass}>
              <option value="active">Aktif</option>
              <option value="suspended">Askıda (ajan aramaları yetkiliye aktarır)</option>
            </select>
          </Field>
        </div>
        <ActionButton type="submit" disabled={busy}>
          Kaydet
        </ActionButton>
      </form>
    </Block>
  );
}

/** Kurulum → İletişim ve mesajlar: where the clinic is reached, and how patients are messaged. */
function ContactForm({ clinic, busy, act }: { clinic: AdminClinic; busy: boolean; act: Act }) {
  const [f, setF] = useState({
    notifyEmail: clinic.notifyEmail ?? "",
    transferNumber: clinic.transferNumber ?? "",
    messageChannel: clinic.messageChannel,
    crmWebhookUrl: clinic.crmWebhookUrl ?? "",
    timeZone: clinic.timeZone,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Block>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ action: "update", clinicId: clinic.id, fields: f });
        }}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Bildirim e-postası">
            <input value={f.notifyEmail} onChange={set("notifyEmail")} placeholder="klinik@ornek.com" className={inputClass} />
          </Field>
          <Field label="Aktarma numarası">
            <input value={f.transferNumber} onChange={set("transferNumber")} placeholder="+90 212 555 00 00" className={inputClass} />
          </Field>
          <Field label="Hasta mesajları (onay, hatırlatma)">
            {/* SMS needs the NETGSM_* variables on the automation app; WhatsApp needs Meta-approved templates. */}
            <select value={f.messageChannel} onChange={set("messageChannel")} className={inputClass}>
              <option value="off">Kapalı</option>
              <option value="sms">SMS (Netgsm, yalnızca TR cep)</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </Field>
          <Field label="CRM webhook (opsiyonel)">
            <input value={f.crmWebhookUrl} onChange={set("crmWebhookUrl")} placeholder="https://…" className={inputClass} />
          </Field>
          <Field label="Saat dilimi">
            <input value={f.timeZone} onChange={set("timeZone")} className={inputClass} />
          </Field>
        </div>
        <ActionButton type="submit" disabled={busy}>
          Kaydet
        </ActionButton>
      </form>
    </Block>
  );
}

/** An "active" subscription whose paid-through day has gone by reads as late. */
function effectiveBilling(c: AdminClinic): BillingStatus {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  if (c.billingStatus === "active" && c.paidThrough && c.paidThrough < today) return "past_due";
  return c.billingStatus;
}

function BillingBadge({ clinic }: { clinic: AdminClinic }) {
  const s = effectiveBilling(clinic);
  if (s === "active") return null;
  return (
    <Badge tone={s === "pending" ? "warning" : "destructive"} className="shrink-0 text-[10px]">
      {BILLING_STATUSES[s].toLocaleLowerCase("tr-TR")}
    </Badge>
  );
}

/**
 * Ruul subscription, recorded by hand: the checkout link goes to the clinic
 * over WhatsApp/e-mail, and the operator marks it paid here. Changing it never
 * suspends the clinic — that stays a separate, deliberate choice in Paket ve durum.
 */
function BillingForm({ clinic, busy, act }: { clinic: AdminClinic; busy: boolean; act: Act }) {
  const [f, setF] = useState({
    billingStatus: clinic.billingStatus,
    checkoutUrl: clinic.checkoutUrl ?? "",
    paidThrough: clinic.paidThrough ?? "",
  });
  const [copied, setCopied] = useState(false);
  const late = effectiveBilling(clinic) === "past_due" && clinic.billingStatus === "active";

  return (
    <Block
      hint="Ödeme linkini müşteriye kendin gönderirsin; ödeme gelince durumu ve son günü buradan işaretle."
    >
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ action: "update", clinicId: clinic.id, fields: f });
        }}
      >
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label="Durum">
            <select
              value={f.billingStatus}
              onChange={(e) => setF((p) => ({ ...p, billingStatus: e.target.value as BillingStatus }))}
              className={inputClass}
            >
              {(Object.keys(BILLING_STATUSES) as BillingStatus[]).map((s) => (
                <option key={s} value={s}>
                  {BILLING_STATUSES[s]}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Ruul ödeme linki">
              <input
                value={f.checkoutUrl}
                onChange={(e) => setF((p) => ({ ...p, checkoutUrl: e.target.value }))}
                placeholder="https://…"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Geçerli olduğu son gün">
            <input
              type="date"
              value={f.paidThrough}
              onChange={(e) => setF((p) => ({ ...p, paidThrough: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>
        {late && <p className="text-[11px] text-missed">Son gün geçti; yeni ödeme geldiyse tarihi ilerlet.</p>}
        <div className="flex flex-wrap gap-2">
          <ActionButton type="submit" disabled={busy}>
            Aboneliği kaydet
          </ActionButton>
          {clinic.checkoutUrl && (
            <ActionButton
              onClick={() => {
                void navigator.clipboard.writeText(clinic.checkoutUrl!).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Kopyalandı" : "Linki kopyala"}
            </ActionButton>
          )}
        </div>
      </form>
    </Block>
  );
}

const CONTRACT_STATUS = {
  none: "hazır değil",
  required: "kabul bekliyor",
  accepted: "kabul edildi",
} as const;

/**
 * Hizmet + Veri İşleme Sözleşmesi (lib/contracts/server.ts): the customer's
 * details and Ek-1 go in here; the clinic then accepts both in its panel with
 * two ticks. A paper signature of the same terms can be recorded instead.
 * Any change to these fields asks the clinic to accept again.
 */
function ContractForm({ clinic, busy, act }: { clinic: AdminClinic; busy: boolean; act: Act }) {
  const t = clinic.contract.terms;
  const [f, setF] = useState({
    legalName: t?.legalName ?? "",
    taxId: t?.taxId ?? "",
    address: t?.address ?? "",
    email: t?.email ?? clinic.notifyEmail ?? "",
    monthlyFee: t?.monthlyFee ?? `${PLANS[clinic.plan].priceUsd} USD`,
    overageFee: t?.overageFee ?? `${usd(OVERAGE_USD_PER_MIN, 2)} USD`,
    setupFee: t?.setupFee ?? `${SETUP_FEE_USD} USD`,
    trialDays: t?.trialDays ? String(t.trialDays) : "",
    paymentMethod: t?.paymentMethod ?? "Ödeme bağlantısı (Ruul)",
    lineFeesBy: (t?.lineFeesBy ?? "clinic") as ContractTerms["lineFeesBy"],
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const { status, reason, accepted } = clinic.contract;
  const when = accepted ? new Date(accepted.acceptedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : null;

  return (
    <Block
      hint="Bilgileri gir ve kaydet; klinik panele girince iki sözleşmeyi görüp tik atarak kabul eder. Kabul olmadan hat bağlanmaz. Bilgileri değiştirirsen yeniden kabul ister."
    >
      {accepted && (
        <p className="text-[11px] text-muted-foreground">
          Son kabul: {when} · {accepted.method === "paper" ? "ıslak imza" : accepted.email ?? "—"} · sürüm {accepted.version}
          {status === "required" && <span className="text-warning"> — eski metin/bilgiler; yeniden kabul gerekiyor</span>}
        </p>
      )}
      {status === "none" && reason && <p className="text-[11px] text-missed">{reason}</p>}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ action: "setContractTerms", clinicId: clinic.id, terms: f });
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Unvan">
            <input value={f.legalName} onChange={set("legalName")} placeholder="Örnek Ağız ve Diş Sağlığı Ltd. Şti." className={inputClass} />
          </Field>
          <Field label="Vergi dairesi / no">
            <input value={f.taxId} onChange={set("taxId")} placeholder="Nilüfer VD / 1234567890" className={inputClass} />
          </Field>
          <Field label="Adres">
            <input value={f.address} onChange={set("address")} className={inputClass} />
          </Field>
          <Field label="Bildirim e-postası">
            <input value={f.email} onChange={set("email")} placeholder="info@klinik.com" className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Aylık ücret (KDV hariç)">
            <input value={f.monthlyFee} onChange={set("monthlyFee")} className={inputClass} />
          </Field>
          <Field label="Aşım ücreti / dk">
            <input value={f.overageFee} onChange={set("overageFee")} className={inputClass} />
          </Field>
          <Field label="Kurulum ücreti (tek seferlik, boş = yok)">
            <input value={f.setupFee} onChange={set("setupFee")} className={inputClass} />
          </Field>
          <Field label="Ücretsiz deneme, gün (boş = yok)">
            <input value={f.trialDays} onChange={set("trialDays")} inputMode="numeric" placeholder="14" className={inputClass} />
          </Field>
          <Field label="Ödeme yöntemi">
            <input value={f.paymentMethod} onChange={set("paymentMethod")} className={inputClass} />
          </Field>
          <Field label="Hat / operatör ücretleri">
            <select value={f.lineFeesBy} onChange={set("lineFeesBy")} className={inputClass}>
              <option value="clinic">Klinik öder</option>
              <option value="provider">Hizmet Sağlayıcı öder</option>
            </select>
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Paket ve dakika, Paket ve durum bölümünden gelir ({PLANS[clinic.plan].label}, {clinic.minutesQuota} dk).
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionButton type="submit" disabled={busy}>
            Sözleşme bilgilerini kaydet
          </ActionButton>
          {status === "required" && (
            <ActionButton
              disabled={busy}
              onClick={() => void act({ action: "recordPaperContract", clinicId: clinic.id })}
            >
              Islak imzalı olarak işaretle
            </ActionButton>
          )}
        </div>
      </form>
    </Block>
  );
}

/**
 * The line: agents are provisioned onto Vapi from here (or from the clinic's
 * own /agents saves), and the Netgsm number — added to Vapi once, by hand —
 * is pointed at one of them. Steps: TELEFON-KURULUMU.md.
 */
function PhoneForm({ clinic, busy, act }: { clinic: AdminClinic; busy: boolean; act: Act }) {
  const provisioned = clinic.agents.filter((a) => a.vapiAssistantId);
  const inbound = clinic.agents.find((a) => a.id === clinic.phone?.inboundAgentId);
  const night = clinic.agents.find((a) => a.id === clinic.afterHoursAgentId);
  const [agentId, setAgentId] = useState(clinic.phone?.inboundAgentId ?? "");
  const [nightId, setNightId] = useState(clinic.afterHoursAgentId ?? "");
  const [ids, setIds] = useState({
    vapiPhoneNumberId: clinic.vapiPhoneNumberId ?? "",
    vapiOutboundPhoneNumberId: clinic.vapiOutboundPhoneNumberId ?? "",
  });

  return (
    <Block
      hint="Numara Vapi panelinde bir kez eklenir (TELEFON-KURULUMU.md). Ajanlar buradan kurulur, numarayı hangisinin açacağını buradan seçersin."
    >
      <p className="text-xs">
        {!clinic.vapiPhoneNumberId ? (
          <span className="text-missed">{"Numara yok — aşağıya Vapi numara ID'sini yaz."}</span>
        ) : clinic.phone?.error ? (
          <span className="text-missed">{clinic.phone.error}</span>
        ) : (
          <>
            <span className="font-mono">{clinic.phone?.number ?? "—"}</span>
            <span className="text-muted-foreground"> → </span>
            {inbound ? (
              <span className="text-booked">{inbound.name}</span>
            ) : (
              <span className="text-missed">hiçbir ajana bağlı değil — aramalar cevapsız kalır</span>
            )}
            {inbound && clinic.phone?.routed && (
              <span className="text-muted-foreground">
                {night ? ` · mesai dışında ${night.name}` : " · mesai dışı ajanı yok, 7/24 aynı ajan"}
              </span>
            )}
          </>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {`Vapi'de kurulu: ${provisioned.length}/${clinic.agents.length} ajan`}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full max-w-[240px]">
          <Field label="Gelen aramaları karşılayan ajan">
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputClass}>
              <option value="">— hiçbiri —</option>
              {provisioned.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.active ? "" : " (duraklatılmış)"}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ActionButton
          disabled={busy || !clinic.vapiPhoneNumberId}
          onClick={() => void act({ action: "assignNumber", clinicId: clinic.id, agentId })}
        >
          Numaraya bağla
        </ActionButton>
        <ActionButton
          disabled={busy || clinic.agents.length === 0}
          onClick={() => void act({ action: "syncAgents", clinicId: clinic.id })}
        >
          {"Ajanları Vapi'ye kur"}
        </ActionButton>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full max-w-[240px]">
          <Field label="Mesai dışında karşılayan ajan">
            <select value={nightId} onChange={(e) => setNightId(e.target.value)} className={inputClass}>
              <option value="">— yok (gündüz ajanı 7/24) —</option>
              {provisioned
                .filter((a) => a.id !== clinic.phone?.inboundAgentId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.active ? "" : " (duraklatılmış)"}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <ActionButton
          disabled={busy || !clinic.phone?.routed}
          onClick={() => void act({ action: "setAfterHours", clinicId: clinic.id, agentId: nightId })}
        >
          Kaydet
        </ActionButton>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {"Mesai saatleri, gündüz ajanının çalışma saatleridir. Mesai dışı ajanı randevuyu bu saatlere verir, aktarma yapmaz."}
      </p>
      <form
        className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ action: "update", clinicId: clinic.id, fields: ids });
        }}
      >
        <div className="w-full max-w-[240px]">
          <Field label="Vapi numara ID">
            <input
              value={ids.vapiPhoneNumberId}
              onChange={(e) => setIds((p) => ({ ...p, vapiPhoneNumberId: e.target.value }))}
              placeholder="Vapi → Phone Numbers → ID"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="w-full max-w-[240px]">
          <Field label="Giden arama numara ID (opsiyonel)">
            <input
              value={ids.vapiOutboundPhoneNumberId}
              onChange={(e) => setIds((p) => ({ ...p, vapiOutboundPhoneNumberId: e.target.value }))}
              placeholder="Boşsa gelen arama numarası"
              className={inputClass}
            />
          </Field>
        </div>
        <ActionButton type="submit" disabled={busy}>
          Numara ID kaydet
        </ActionButton>
      </form>
    </Block>
  );
}

const LEAD_STATUS_LABEL = {
  new: "yeni",
  waiting: "bekliyor",
  calling: "aranıyor",
  called: "arandı",
  failed: "başarısız",
  skipped: "atlandı",
} as const;

/**
 * Hızlı geri dönüş: which agent phones new leads, and the form URL that
 * feeds it. Steps and a ready-made form: HIZLI-GERI-DONUS.md.
 */
function CallbackForm({ clinic, busy, act }: { clinic: AdminClinic; busy: boolean; act: Act }) {
  const provisioned = clinic.agents.filter((a) => a.vapiAssistantId);
  const [agentId, setAgentId] = useState(clinic.callbackAgentId ?? "");
  const url = clinic.leadFormKey ? `https://www.${appConfig.domain}/api/leads?key=${clinic.leadFormKey}` : null;
  const counts = Object.entries(clinic.leadCounts).filter(([, n]) => n > 0);

  return (
    <Block
      hint="Kliniğin formunu dolduran hastayı seçilen ajan hemen arar; mesai dışındaysa klinik açılınca. Kurulum: HIZLI-GERI-DONUS.md."
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full max-w-[240px]">
          <Field label="Arayacak ajan">
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputClass}>
              <option value="">— kapalı —</option>
              {provisioned.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.active ? "" : " (duraklatılmış)"}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ActionButton disabled={busy} onClick={() => void act({ action: "setCallback", clinicId: clinic.id, agentId })}>
          Kaydet
        </ActionButton>
        {url && (
          <ActionButton disabled={busy} onClick={() => void act({ action: "rotateLeadKey", clinicId: clinic.id })}>
            Adresi yenile
          </ActionButton>
        )}
      </div>
      {url && (
        <p className="break-all font-mono text-[11px]">
          <span className="text-muted-foreground">Form adresi (POST): </span>
          {url}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Son 30 gün:{" "}
        {counts.length
          ? counts.map(([s, n]) => `${n} ${LEAD_STATUS_LABEL[s as keyof typeof LEAD_STATUS_LABEL]}`).join(" · ")
          : "başvuru yok"}
      </p>
    </Block>
  );
}

function CalendarForm({ clinic, busy, act }: { clinic: AdminClinic; busy: boolean; act: Act }) {
  const [apiKey, setApiKey] = useState("");
  const [eventTypeId, setEventTypeId] = useState("");

  return (
    <Block
      hint="Anahtar kaydedildikten sonra bir daha gösterilmez. Değiştirmek için yenisini yaz."
    >
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ action: "setCalendar", clinicId: clinic.id, apiKey, eventTypeId: Number(eventTypeId) });
          setApiKey("");
        }}
      >
        <div className="w-full max-w-[260px]">
          <Field label="API anahtarı">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="cal_live_…"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="w-full max-w-[140px]">
          <Field label="Event type id">
            <input value={eventTypeId} onChange={(e) => setEventTypeId(e.target.value)} inputMode="numeric" className={inputClass} />
          </Field>
        </div>
        <ActionButton type="submit" disabled={busy || !apiKey || !eventTypeId}>
          Bağla
        </ActionButton>
        {clinic.calendarConnected && (
          <ActionButton
            destructive
            disabled={busy}
            onClick={() => void act({ action: "setCalendar", clinicId: clinic.id, apiKey: "", eventTypeId: "" })}
          >
            Bağlantıyı kaldır
          </ActionButton>
        )}
      </form>
    </Block>
  );
}

function Members({
  clinic,
  users,
  busy,
  act,
}: {
  clinic: AdminClinic;
  users: AdminUser[];
  busy: boolean;
  act: Act;
}) {
  const memberIds = new Set(clinic.members.map((m) => m.userId));
  const candidates = users.filter((u) => !memberIds.has(u.id));
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "staff">("staff");

  return (
    <Block hint="Kayıt kapalı: klinik çalışanlarının hesabını buradan sen açarsın, şifreyi kendin iletirsin.">
      {clinic.members.length === 0 ? (
        <p className="text-xs text-missed">Bu klinikte kimse yok — panele kimse giremez.</p>
      ) : (
        <ul className="space-y-1">
          {clinic.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="truncate">{m.email ?? m.userId}</span>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                {m.role === "owner" ? "sahip" : "çalışan"}
              </span>
              <ActionButton
                destructive
                disabled={busy}
                onClick={() => void act({ action: "removeMember", clinicId: clinic.id, userId: m.userId })}
              >
                Çıkar
              </ActionButton>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full max-w-[260px]">
          <Field label="Mevcut kullanıcıyı ekle">
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputClass}>
              <option value="">Seç…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email ?? u.id}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <RoleSelect value={role} onChange={setRole} />
        <ActionButton
          disabled={busy || !userId}
          onClick={() => {
            void act({ action: "addMember", clinicId: clinic.id, userId, role });
            setUserId("");
          }}
        >
          Ekle
        </ActionButton>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ action: "createMember", clinicId: clinic.id, email, password, role });
          setEmail("");
          setPassword("");
        }}
      >
        <div className="w-full max-w-[220px]">
          <Field label="Yeni hesap: e-posta">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="w-full max-w-[180px]">
          <Field label={`Şifre (en az ${MIN_PASSWORD_LENGTH})`}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
        </div>
        <ActionButton type="submit" disabled={busy || !email || password.length < MIN_PASSWORD_LENGTH}>
          Hesap oluştur
        </ActionButton>
      </form>
    </Block>
  );
}

function RoleSelect({ value, onChange }: { value: "owner" | "staff"; onChange: (r: "owner" | "staff") => void }) {
  return (
    <div className="w-full max-w-[120px]">
      <Field label="Rol">
        <select value={value} onChange={(e) => onChange(e.target.value as "owner" | "staff")} className={inputClass}>
          <option value="staff">Çalışan</option>
          <option value="owner">Sahip</option>
        </select>
      </Field>
    </div>
  );
}
