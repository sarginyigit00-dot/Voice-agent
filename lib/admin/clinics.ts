import { getSupabaseServer } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH, PLANS, isPlan, type PlanId } from "@/lib/admin/constants";
import { clinicById } from "@/lib/clinics/server";
import {
  assignPhoneNumber,
  isVapiConfigured,
  listPhoneNumbers,
  type VapiPhoneNumber,
  type VapiResult,
} from "@/lib/vapi/client";
import { syncAgentToVapi, type VapiSyncResult } from "@/lib/vapi/sync";

type Supabase = NonNullable<ReturnType<typeof getSupabaseServer>>;

/**
 * Operator-side clinic management — the turnkey model's "set a customer up"
 * console: create the clinic, give it staff accounts, a calendar and a
 * package.
 *
 * Same privacy boundary as lib/admin/actions.ts. Usage comes from an
 * aggregate (seconds and call count per clinic — what the invoice is cut
 * from), never call content. The Cal.com key is written here but never sent
 * back to the panel; it only learns whether one is set.
 */

export interface AdminClinicMember {
  userId: string;
  email: string | null;
  role: string;
}

export interface AdminClinic {
  id: string;
  name: string;
  plan: PlanId;
  minutesQuota: number;
  status: "active" | "suspended";
  timeZone: string;
  transferNumber: string | null;
  notifyEmail: string | null;
  crmWebhookUrl: string | null;
  vapiPhoneNumberId: string | null;
  whatsappEnabled: boolean;
  /** Names only — for picking which agent answers the line. */
  agents: { id: string; name: string; active: boolean; vapiAssistantId: string | null }[];
  /** Live from Vapi: the number and who answers it. Null when the clinic has no number yet. */
  phone: { number: string | null; inboundAgentId: string | null; error?: string } | null;
  createdAt: string;
  calendarConnected: boolean;
  members: AdminClinicMember[];
  /** This calendar month, Türkiye time. */
  minutesThisMonth: number;
  callsThisMonth: number;
}

export interface ClinicActionResult {
  ok: boolean;
  message: string;
}

/** The clinic's number as Vapi sees it right now, and which of its agents answers. */
function phoneFor(
  id: string | null,
  numbers: VapiResult<VapiPhoneNumber[]> | null,
  agents: AdminClinic["agents"],
): AdminClinic["phone"] {
  if (!id) return null;
  if (!numbers) return { number: null, inboundAgentId: null, error: "Vapi bağlı değil (VAPI_API_KEY yok)." };
  if (!numbers.ok) return { number: null, inboundAgentId: null, error: `Vapi: ${numbers.error}` };
  const n = numbers.data.find((x) => x.id === id);
  if (!n) return { number: null, inboundAgentId: null, error: "Bu numara ID'si Vapi'de yok." };

  const inbound = agents.find((a) => a.vapiAssistantId && a.vapiAssistantId === n.assistantId);
  return {
    number: n.number ?? n.sipUri ?? null,
    inboundAgentId: inbound?.id ?? null,
    error: n.assistantId && !inbound ? "Numara bu kliniğin ajanı olmayan bir asistana bağlı." : undefined,
  };
}

/** Start of the current month in Türkiye — UTC+3 all year, no DST since 2016. */
function monthStartIstanbul(now = new Date()): Date {
  const OFFSET = 3 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + OFFSET);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET);
}

export async function listClinics(
  supabase: Supabase,
  emails: Map<string, string | null>,
): Promise<AdminClinic[]> {
  const [clinics, members, secrets, usage, agents, numbers] = await Promise.all([
    supabase.from("clinics").select("*").order("created_at", { ascending: true }),
    supabase.from("clinic_members").select("clinic_id, user_id, role").order("created_at"),
    supabase.from("clinic_secrets").select("clinic_id, calcom_api_key, calcom_event_type_id"),
    // An aggregate in SQL, not rows here: PostgREST caps a response at 1,000
    // rows, which one busy clinic passes within a week.
    supabase.rpc("clinic_usage_since", { since: monthStartIstanbul().toISOString() }),
    supabase.from("agents").select("id, name, active, clinic_id, vapi_assistant_id").order("created_at"),
    // One call for every clinic's number, not one per clinic.
    isVapiConfigured() ? listPhoneNumbers() : Promise.resolve(null),
  ]);

  if (clinics.error) {
    console.error("[admin] failed to list clinics:", clinics.error.message);
    return [];
  }
  if (members.error) console.error("[admin] failed to list clinic members:", members.error.message);
  if (secrets.error) console.error("[admin] failed to read clinic secrets:", secrets.error.message);
  if (usage.error) console.error("[admin] failed to read clinic usage:", usage.error.message);
  if (agents.error) console.error("[admin] failed to list agents:", agents.error.message);
  if (numbers && !numbers.ok) console.error("[admin] failed to list Vapi numbers:", numbers.error);

  const connected = new Set(
    (secrets.data ?? [])
      .filter((s) => s.calcom_api_key && Number(s.calcom_event_type_id) > 0)
      .map((s) => s.clinic_id as string),
  );
  const usageBy = new Map(
    ((usage.data ?? []) as { clinic_id: string; seconds: number; calls: number }[]).map((u) => [
      u.clinic_id,
      u,
    ]),
  );

  return clinics.data.map((c) => {
    const used = usageBy.get(c.id);
    const clinicAgents = (agents.data ?? [])
      .filter((a) => a.clinic_id === c.id)
      .map((a) => ({ id: a.id, name: a.name, active: a.active, vapiAssistantId: a.vapi_assistant_id }));
    return {
      id: c.id,
      name: c.name,
      plan: isPlan(c.plan) ? c.plan : "klinik",
      minutesQuota: c.minutes_quota,
      status: c.status === "suspended" ? "suspended" : "active",
      timeZone: c.time_zone,
      transferNumber: c.transfer_number,
      notifyEmail: c.notify_email,
      crmWebhookUrl: c.crm_webhook_url,
      vapiPhoneNumberId: c.vapi_phone_number_id,
      whatsappEnabled: Boolean(c.whatsapp_enabled),
      agents: clinicAgents,
      phone: phoneFor(c.vapi_phone_number_id, numbers, clinicAgents),
      createdAt: c.created_at,
      calendarConnected: connected.has(c.id),
      members: (members.data ?? [])
        .filter((m) => m.clinic_id === c.id)
        .map((m) => ({ userId: m.user_id, email: emails.get(m.user_id) ?? null, role: m.role })),
      minutesThisMonth: Math.ceil(Number(used?.seconds ?? 0) / 60),
      callsThisMonth: Number(used?.calls ?? 0),
    };
  });
}

/* ─────────────────────────────── writes ─────────────────────────────── */

const ok = (message: string): ClinicActionResult => ({ ok: true, message });
const fail = (message: string): ClinicActionResult => ({ ok: false, message });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The editable clinic settings, validated one by one. Only keys present in
 * the request are touched.
 */
function parseClinicFields(raw: unknown): { patch: Record<string, unknown> } | { error: string } {
  const f = (raw ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if ("name" in f) {
    if (!text(f.name)) return { error: "Klinik adı boş olamaz." };
    patch.name = text(f.name);
  }
  if ("plan" in f) {
    if (!isPlan(f.plan)) return { error: "Geçersiz paket." };
    patch.plan = f.plan;
  }
  if ("minutesQuota" in f) {
    const n = Number(f.minutesQuota);
    if (!Number.isInteger(n) || n < 0) return { error: "Dakika kotası 0 veya daha büyük bir tam sayı olmalı." };
    patch.minutes_quota = n;
  }
  if ("status" in f) {
    if (f.status !== "active" && f.status !== "suspended") return { error: "Geçersiz durum." };
    patch.status = f.status;
  }
  if ("timeZone" in f) {
    const tz = text(f.timeZone);
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
    } catch {
      return { error: `Tanınmayan saat dilimi: ${tz}` };
    }
    patch.time_zone = tz;
  }
  if ("transferNumber" in f) {
    const v = text(f.transferNumber);
    if (v && !/^\+?[0-9 ()-]{6,20}$/.test(v)) return { error: "Aktarma numarası geçersiz (ör. +90 212 555 00 00)." };
    patch.transfer_number = v || null;
  }
  if ("notifyEmail" in f) {
    const v = text(f.notifyEmail);
    if (v && !EMAIL.test(v)) return { error: "Bildirim e-postası geçersiz." };
    patch.notify_email = v || null;
  }
  if ("crmWebhookUrl" in f) {
    const v = text(f.crmWebhookUrl);
    if (v) {
      let url: URL;
      try {
        url = new URL(v);
      } catch {
        return { error: "CRM webhook adresi geçersiz." };
      }
      // Every finished call's transcript goes here — never over plain http.
      if (url.protocol !== "https:") return { error: "CRM webhook adresi https:// ile başlamalı." };
    }
    patch.crm_webhook_url = v || null;
  }

  if ("vapiPhoneNumberId" in f) {
    const v = text(f.vapiPhoneNumberId);
    // The id from Vapi → Phone Numbers, not the number: pasting the number
    // itself is the easy mistake, and it would silently match nothing.
    if (v && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
      return { error: "Vapi numara ID'si, Vapi → Phone Numbers'taki UUID olmalı (numaranın kendisi değil)." };
    }
    patch.vapi_phone_number_id = v || null;
  }

  if ("whatsappEnabled" in f) {
    if (typeof f.whatsappEnabled !== "boolean") return { error: "WhatsApp ayarı geçersiz." };
    patch.whatsapp_enabled = f.whatsappEnabled;
  }

  if (Object.keys(patch).length === 0) return { error: "Değiştirilecek alan yok." };
  return { patch };
}

function isRole(v: unknown): v is "owner" | "staff" {
  return v === "owner" || v === "staff";
}

/** Every write the "Klinikler" tab can make. Validates its own input — the route passes the raw body. */
export async function runClinicAction(body: unknown): Promise<ClinicActionResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return fail("Supabase bağlı değil.");

  const b = (body ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const clinicId = str("clinicId");

  switch (b.action) {
    case "create": {
      const name = str("name");
      if (!name) return fail("Klinik adı gerekli.");
      const plan: PlanId = isPlan(b.plan) ? b.plan : "klinik";
      const { error } = await supabase
        .from("clinics")
        .insert({ name, plan, minutes_quota: PLANS[plan].minutes });
      if (error) return fail(error.message);
      return ok(`"${name}" oluşturuldu. Şimdi kullanıcı ekleyip takvimini bağla.`);
    }

    case "update": {
      if (!clinicId) return fail("Klinik seçilmedi.");
      const parsed = parseClinicFields(b.fields);
      if ("error" in parsed) return fail(parsed.error);
      const { error } = await supabase.from("clinics").update(parsed.patch).eq("id", clinicId);
      if (error) return fail(error.message);
      return ok("Klinik ayarları kaydedildi.");
    }

    case "setCalendar": {
      if (!clinicId) return fail("Klinik seçilmedi.");
      const apiKey = str("apiKey");
      const eventTypeId = Number(b.eventTypeId);

      // Both empty = disconnect. The agent then says the calendar is
      // unavailable and offers a person, rather than booking anywhere else.
      if (!apiKey && !b.eventTypeId) {
        const { error } = await supabase.from("clinic_secrets").delete().eq("clinic_id", clinicId);
        if (error) return fail(error.message);
        return ok("Takvim bağlantısı kaldırıldı.");
      }
      if (!apiKey) return fail("Cal.com API anahtarı gerekli.");
      if (!Number.isInteger(eventTypeId) || eventTypeId <= 0) return fail("Event type id pozitif bir sayı olmalı.");

      const { error } = await supabase.from("clinic_secrets").upsert(
        {
          clinic_id: clinicId,
          calcom_api_key: apiKey,
          calcom_event_type_id: eventTypeId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clinic_id" },
      );
      if (error) return fail(error.message);
      return ok("Takvim bağlandı.");
    }

    case "addMember": {
      const userId = str("userId");
      if (!clinicId || !userId) return fail("Klinik ve kullanıcı seçilmeli.");
      const role = isRole(b.role) ? b.role : "staff";
      const { error } = await supabase
        .from("clinic_members")
        .upsert({ clinic_id: clinicId, user_id: userId, role }, { onConflict: "clinic_id,user_id" });
      if (error) return fail(error.message);
      return ok("Kullanıcı kliniğe eklendi.");
    }

    case "createMember": {
      // Sign-up is closed (turnkey), so this is how a clinic's staff get an
      // account: the operator creates it, already confirmed, and hands the
      // password over out-of-band — same as the Users tab's "Şifre belirle".
      const email = str("email").toLowerCase();
      const password = typeof b.password === "string" ? b.password : "";
      if (!clinicId) return fail("Klinik seçilmedi.");
      if (!EMAIL.test(email)) return fail("Geçerli bir e-posta gir.");
      if (password.length < MIN_PASSWORD_LENGTH) return fail(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
      const role = isRole(b.role) ? b.role : "staff";

      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) return fail(error?.message ?? "Kullanıcı oluşturulamadı.");

      const { error: memberError } = await supabase
        .from("clinic_members")
        .insert({ clinic_id: clinicId, user_id: data.user.id, role });
      if (memberError) {
        return fail(
          `Hesap oluşturuldu ama kliniğe eklenemedi: ${memberError.message}. "Mevcut kullanıcıyı ekle" ile tekrar dene.`,
        );
      }
      return ok(`${email} oluşturuldu ve kliniğe eklendi. Şifreyi kullanıcıya kendin ilet.`);
    }

    case "removeMember": {
      const userId = str("userId");
      if (!clinicId || !userId) return fail("Klinik ve kullanıcı seçilmeli.");
      const { error } = await supabase
        .from("clinic_members")
        .delete()
        .eq("clinic_id", clinicId)
        .eq("user_id", userId);
      if (error) return fail(error.message);
      return ok("Kullanıcı klinikten çıkarıldı. Hesabı silinmedi.");
    }

    case "syncAgents": {
      // The operator provisioning a clinic's agents without signing in as its staff.
      const clinic = clinicId ? await clinicById(clinicId) : null;
      if (!clinic) return fail("Klinik bulunamadı.");
      const { data, error } = await supabase.from("agents").select("id, name").eq("clinic_id", clinic.id);
      if (error) return fail(error.message);
      if (!data.length) {
        return fail("Bu klinikte ajan yok. Klinik /agents sayfasını ilk açtığında başlangıç ajanları oluşur.");
      }

      const results: ({ name: string } & VapiSyncResult)[] = [];
      for (const a of data) results.push({ name: a.name, ...(await syncAgentToVapi(a.id, clinic)) });
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        return fail(
          `${results.length - failed.length}/${results.length} ajan kuruldu. ` +
            failed.map((r) => `${r.name}: ${r.message}`).join(" · "),
        );
      }
      const notes = results.filter((r) => r.warning).map((r) => `${r.name}: ${r.warning}`);
      return ok([`${results.length} ajan Vapi'ye kuruldu.`, ...notes].join(" "));
    }

    case "assignNumber": {
      const clinic = clinicId ? await clinicById(clinicId) : null;
      if (!clinic) return fail("Klinik bulunamadı.");
      if (!clinic.vapiPhoneNumberId) return fail("Önce Ayarlar'dan Vapi numara ID'sini kaydet.");

      // Empty agentId = detach the number.
      const agentId = str("agentId");
      let assistantId: string | null = null;
      if (agentId) {
        const { data, error } = await supabase
          .from("agents")
          .select("vapi_assistant_id")
          .eq("id", agentId)
          .eq("clinic_id", clinic.id)
          .maybeSingle();
        if (error) return fail(error.message);
        if (!data) return fail("Ajan bu klinikte değil.");
        if (!data.vapi_assistant_id) return fail("Bu ajan henüz Vapi'de kurulu değil — önce \"Ajanları Vapi'ye kur\".");
        assistantId = data.vapi_assistant_id;
      }

      const res = await assignPhoneNumber(clinic.vapiPhoneNumberId, assistantId);
      if (!res.ok) return fail(`Vapi: ${res.error}`);
      return ok(assistantId ? "Numara ajana bağlandı; gelen aramaları artık bu ajan karşılar." : "Numara ajandan ayrıldı.");
    }

    default:
      return fail("Geçersiz istek.");
  }
}
