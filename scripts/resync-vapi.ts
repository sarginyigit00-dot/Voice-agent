// One-off: re-provisions every Vapi-linked agent of a clinic through the real
// sync path (same as /admin → "Ajanları Vapi'ye kur"). Prints status only.
// npx tsx --env-file=.env.local scripts/resync-vapi.ts <clinicId>
import { clinicById } from "@/lib/clinics/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { syncAgentToVapi } from "@/lib/vapi/sync";

(async () => {
  const clinicId = process.argv[2];
  const clinic = clinicId ? await clinicById(clinicId) : null;
  if (!clinic) throw new Error("Klinik bulunamadı.");
  const { data } = await getSupabaseServer()!
    .from("agents")
    .select("id, name")
    .eq("clinic_id", clinic.id)
    .not("vapi_assistant_id", "is", null);
  for (const a of data ?? []) {
    const r = await syncAgentToVapi(a.id, clinic);
    console.log(a.name, "-", r.ok ? "OK" : "HATA", "-", r.message, r.warning ? `(${r.warning})` : "");
  }
})();
