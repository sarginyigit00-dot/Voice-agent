import { getSupabaseServer } from "@/lib/supabase/server";
import { agentInClinic, clinicOpeningHours, isAfterHoursAgent, type ClinicContext } from "@/lib/clinics/server";
import { getKnowledge } from "@/lib/clinics/knowledge";
import {
  assignPhoneNumber,
  deleteAssistant,
  getPhoneNumber,
  isVapiConfigured,
  transferTarget,
  upsertAssistant,
} from "@/lib/vapi/client";

/**
 * Keeps one agent row and its Vapi assistant in step. Shared by the /agents
 * save path (app/api/agents/sync) and the operator's "Ajanları Vapi'ye kur"
 * button in /admin, so both provision the exact same thing.
 *
 * Always scoped by clinic: the agent is looked up with the clinic id, never
 * by id alone, because this runs with the service-role key.
 */

export interface VapiSyncResult {
  ok: boolean;
  message: string;
  vapiAssistantId?: string | null;
  /** Synced, but something the clinic should know (e.g. transfer has nowhere to go). */
  warning?: string;
}

export async function syncAgentToVapi(
  agentId: string,
  clinic: ClinicContext,
  retried = false,
): Promise<VapiSyncResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, message: "Supabase bağlı değil." };
  if (!isVapiConfigured()) return { ok: false, message: "Vapi bağlı değil (VAPI_API_KEY yok)." };

  const found = await agentInClinic(agentId, clinic.id);
  if (!found) return { ok: false, message: "Ajan bulunamadı." };
  const { agent, vapiAssistantId } = found;

  // The after-hours agent books into the clinic's opening hours, not its own.
  const openingHours = isAfterHoursAgent(clinic, agent.id) ? await clinicOpeningHours(clinic) : null;
  const res = await upsertAssistant(agent, clinic, vapiAssistantId, await getKnowledge(clinic.id), openingHours);
  if (!res.ok) return { ok: false, message: `Vapi: ${res.error}` };
  const id = res.data.id;

  if (id !== vapiAssistantId) {
    // Only claim the row if it still holds the id we read. Two saves in quick
    // succession (e.g. toggling twice) would otherwise both POST and leave an
    // orphan assistant in Vapi.
    const claim = supabase
      .from("agents")
      .update({ vapi_assistant_id: id })
      .eq("id", agent.id)
      .eq("clinic_id", clinic.id);
    const { data: claimed, error } = await (vapiAssistantId
      ? claim.eq("vapi_assistant_id", vapiAssistantId)
      : claim.is("vapi_assistant_id", null)
    ).select("id");
    if (error) {
      // The assistant exists in Vapi but calls to it won't be recognised —
      // the webhook matches on this column. Say so rather than report success.
      return { ok: false, message: `Vapi'de oluşturuldu ama kaydedilemedi: ${error.message}` };
    }
    if (!claimed?.length) {
      // Another sync got there first: drop ours and update theirs instead.
      if (res.data.created) await deleteAssistant(id);
      if (!retried) return syncAgentToVapi(agentId, clinic, true);
      return { ok: false, message: "Ajan aynı anda başka bir yerden güncellendi; tekrar deneyin." };
    }
  }

  const warnings: string[] = [];

  // A paused agent must stop answering. Only detach the clinic's number if it
  // is actually this agent's — never touch another agent's line.
  if (!agent.active && clinic.vapiPhoneNumberId) {
    const number = await getPhoneNumber(clinic.vapiPhoneNumberId);
    if (number.ok && number.data.assistantId === id) {
      const detached = await assignPhoneNumber(clinic.vapiPhoneNumberId, null);
      warnings.push(
        detached.ok
          ? "Ajan duraklatıldığı için klinik numarasından ayrıldı; numara şu an kimseye bağlı değil."
          : `Ajan duraklatıldı ama numaradan ayrılamadı: ${detached.error}`,
      );
    }
  }

  if (agent.actionIds.includes("transfer") && !transferTarget(agent, clinic)) {
    warnings.push("Aktarma açık ama klinikte geçerli bir aktarma numarası yok — ajan kimseyi aktaramaz.");
  }

  return {
    ok: true,
    message: res.data.created ? "Vapi'de oluşturuldu." : "Vapi'ye eşitlendi.",
    vapiAssistantId: id,
    warning: warnings.join(" ") || undefined,
  };
}

/**
 * Deletes the agent row and its Vapi assistant. The assistant goes first: an
 * orphaned row is harmless, an orphaned assistant keeps answering a number.
 */
export async function removeAgent(agentId: string, clinic: ClinicContext): Promise<VapiSyncResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, message: "Supabase bağlı değil." };

  const found = await agentInClinic(agentId, clinic.id);
  if (!found) return { ok: true, message: "Ajan zaten silinmiş." };

  if (found.vapiAssistantId && isVapiConfigured()) {
    const res = await deleteAssistant(found.vapiAssistantId);
    if (!res.ok) return { ok: false, message: `Vapi'deki ajan silinemedi: ${res.error}` };
  }

  const { error } = await supabase.from("agents").delete().eq("id", agentId).eq("clinic_id", clinic.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Ajan silindi." };
}

/**
 * Re-pushes every agent of a clinic that is already live in Vapi — for
 * changes shared by all of them (the /klinik facts). Agents never provisioned
 * stay that way; this is not the operator's "Ajanları Vapi'ye kur".
 */
export async function syncClinicAgents(clinic: ClinicContext): Promise<({ name: string } & VapiSyncResult)[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("agents")
    .select("id, name")
    .eq("clinic_id", clinic.id)
    .not("vapi_assistant_id", "is", null);
  if (error) return [{ name: "—", ok: false, message: error.message }];

  const results: ({ name: string } & VapiSyncResult)[] = [];
  for (const a of data ?? []) results.push({ name: a.name, ...(await syncAgentToVapi(a.id, clinic)) });
  return results;
}
