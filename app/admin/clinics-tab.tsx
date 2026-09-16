"use client";

import { useState } from "react";
import appConfig from "@/app.config";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MIN_PASSWORD_LENGTH, OVERAGE_USD_PER_MIN, PLANS, type PlanId } from "@/lib/admin/constants";
import type { AdminClinic } from "@/lib/admin/clinics";
import type { AdminUser } from "@/lib/admin/queries";
import { ActionButton, EmptyRow, inputClass } from "./controls";

type Act = (body: Record<string, unknown>) => Promise<void>;

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
  onAct,
}: {
  clinics: AdminClinic[];
  users: AdminUser[];
  connected: boolean;
  onAct: Act;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    await onAct(body);
    setBusy(false);
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

                {openId === c.id && <ClinicEditor clinic={c} users={users} busy={busy} act={act} />}
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

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-xs font-semibold">{title}</h3>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ClinicEditor({
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
  return (
    <div className="space-y-3 border-t border-border/60 bg-muted/40 px-3 py-3">
      <SettingsForm clinic={clinic} busy={busy} act={act} />
      <PhoneForm clinic={clinic} busy={busy} act={act} />
      <CallbackForm clinic={clinic} busy={busy} act={act} />
      <CalendarForm clinic={clinic} busy={busy} act={act} />
      <Members clinic={clinic} users={users} busy={busy} act={act} />
    </div>
  );
}

function SettingsForm({ clinic, busy, act }: { clinic: AdminClinic; busy: boolean; act: Act }) {
  const [f, setF] = useState({
    name: clinic.name,
    plan: clinic.plan,
    minutesQuota: String(clinic.minutesQuota),
    status: clinic.status,
    notifyEmail: clinic.notifyEmail ?? "",
    transferNumber: clinic.transferNumber ?? "",
    crmWebhookUrl: clinic.crmWebhookUrl ?? "",
    timeZone: clinic.timeZone,
    vapiPhoneNumberId: clinic.vapiPhoneNumberId ?? "",
    vapiOutboundPhoneNumberId: clinic.vapiOutboundPhoneNumberId ?? "",
    messageChannel: clinic.messageChannel,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Block title="Ayarlar" hint="Paketi değiştirmek kotayı değiştirmez; özel anlaşmalar için kotayı ayrıca yaz.">
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
          <Field label="Bildirim e-postası">
            <input value={f.notifyEmail} onChange={set("notifyEmail")} placeholder="klinik@ornek.com" className={inputClass} />
          </Field>
          <Field label="Aktarma numarası">
            <input value={f.transferNumber} onChange={set("transferNumber")} placeholder="+90 212 555 00 00" className={inputClass} />
          </Field>
          <Field label="CRM webhook (opsiyonel)">
            <input value={f.crmWebhookUrl} onChange={set("crmWebhookUrl")} placeholder="https://…" className={inputClass} />
          </Field>
          <Field label="Saat dilimi">
            <input value={f.timeZone} onChange={set("timeZone")} className={inputClass} />
          </Field>
          <Field label="Vapi numara ID">
            <input
              value={f.vapiPhoneNumberId}
              onChange={set("vapiPhoneNumberId")}
              placeholder="Vapi → Phone Numbers → ID"
              className={inputClass}
            />
          </Field>
          <Field label="Giden arama numara ID (opsiyonel)">
            <input
              value={f.vapiOutboundPhoneNumberId}
              onChange={set("vapiOutboundPhoneNumberId")}
              placeholder="Boşsa gelen arama numarası"
              className={inputClass}
            />
          </Field>
          <Field label="Hasta mesajları (onay, hatırlatma)">
            {/* SMS needs the NETGSM_* variables on n8n; WhatsApp needs Meta-approved templates. */}
            <select value={f.messageChannel} onChange={set("messageChannel")} className={inputClass}>
              <option value="off">Kapalı</option>
              <option value="sms">SMS (Netgsm, yalnızca TR cep)</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </Field>
        </div>
        <ActionButton type="submit" disabled={busy}>
          Ayarları kaydet
        </ActionButton>
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
  const [agentId, setAgentId] = useState(clinic.phone?.inboundAgentId ?? "");

  return (
    <Block
      title="Telefon (Vapi)"
      hint="Numara Vapi panelinde bir kez eklenir (TELEFON-KURULUMU.md). Ajanlar buradan kurulur, numarayı hangisinin açacağını buradan seçersin."
    >
      <p className="text-xs">
        {!clinic.vapiPhoneNumberId ? (
          <span className="text-missed">{"Numara yok — Ayarlar'a Vapi numara ID'sini yaz."}</span>
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
 * feeds it. Steps and a ready-made form: n8n/HIZLI-GERI-DONUS.md.
 */
function CallbackForm({ clinic, busy, act }: { clinic: AdminClinic; busy: boolean; act: Act }) {
  const provisioned = clinic.agents.filter((a) => a.vapiAssistantId);
  const [agentId, setAgentId] = useState(clinic.callbackAgentId ?? "");
  const current = clinic.agents.find((a) => a.id === clinic.callbackAgentId);
  const url = clinic.leadFormKey ? `https://www.${appConfig.domain}/api/leads?key=${clinic.leadFormKey}` : null;
  const counts = Object.entries(clinic.leadCounts).filter(([, n]) => n > 0);

  return (
    <Block
      title={`Hızlı geri dönüş — ${current ? `açık (${current.name})` : "kapalı"}`}
      hint="Kliniğin formunu dolduran hastayı seçilen ajan hemen arar; mesai dışındaysa klinik açılınca. Kurulum: n8n/HIZLI-GERI-DONUS.md."
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
      title={`Takvim (Cal.com) — ${clinic.calendarConnected ? "bağlı" : "bağlı değil"}`}
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
    <Block title="Kullanıcılar" hint="Kayıt kapalı: klinik çalışanlarının hesabını buradan sen açarsın, şifreyi kendin iletirsin.">
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
