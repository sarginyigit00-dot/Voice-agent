import { getSupabaseServer } from "@/lib/supabase/server";
import { EMPTY_KNOWLEDGE, normalizeKnowledge, type ClinicKnowledge } from "@/lib/clinics/knowledge-shape";

/**
 * Server-side reads and writes of `clinic_knowledge`. Service-role, so every
 * call is scoped by the clinic id the caller already proved membership of
 * (requireMember) — never by an id taken from the request body.
 */

export async function getKnowledge(clinicId: string): Promise<ClinicKnowledge> {
  const supabase = getSupabaseServer();
  if (!supabase) return EMPTY_KNOWLEDGE;

  const { data, error } = await supabase
    .from("clinic_knowledge")
    .select("services, doctors, address, faq")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error) console.error("[knowledge] read failed:", error.message);
  return data ? normalizeKnowledge(data) : EMPTY_KNOWLEDGE;
}

export async function saveKnowledge(
  clinicId: string,
  knowledge: ClinicKnowledge,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, error: "Supabase bağlı değil." };

  const { error } = await supabase.from("clinic_knowledge").upsert(
    {
      clinic_id: clinicId,
      services: knowledge.services,
      doctors: knowledge.doctors,
      address: knowledge.address,
      faq: knowledge.faq,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: "clinic_id" },
  );
  if (error) {
    console.error("[knowledge] write failed:", error.message);
    return { ok: false, error: "Klinik bilgileri kaydedilemedi." };
  }
  return { ok: true };
}
