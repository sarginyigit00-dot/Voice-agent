// Creates or updates the landing page's browser-demo assistant ("Ajanla şimdi
// konuşun", lib/demo/try-call.ts) and prints its id for VAPI_DEMO_ASSISTANT_ID.
// It belongs to no clinic: the webhook answers its tools with sample data.
//
//   npx tsx --env-file=.env.local scripts/sync-demo-assistant.ts
//   npx tsx --env-file=.env.local scripts/sync-demo-assistant.ts --record
//
// --record turns call recording on — only while recording the sample calls
// for the landing page. Run again without it afterwards.
import { DEMO_KNOWLEDGE } from "@/lib/clinics/knowledge-shape";
import { DEMO_CLINIC_NAME } from "@/lib/demo/try-call";
import { upsertDemoAssistant } from "@/lib/demo/demo-assistant";

(async () => {
  const record = process.argv.includes("--record");
  const res = await upsertDemoAssistant({
    clinicName: DEMO_CLINIC_NAME,
    knowledge: DEMO_KNOWLEDGE,
    existingId: process.env.VAPI_DEMO_ASSISTANT_ID?.trim() || null,
    record,
  });
  if (!res.ok) {
    console.error("HATA:", res.error);
    process.exit(1);
  }
  console.log(res.data.created ? "Oluşturuldu." : "Güncellendi.", `Kayıt: ${record ? "AÇIK" : "kapalı"}`);
  console.log(`VAPI_DEMO_ASSISTANT_ID=${res.data.id}`);
})();
