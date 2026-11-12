/**
 * The spoken privacy notice (KVKK aydınlatma) the agent reads ONLY when the
 * caller asks about the recording, their data or KVKK — never on its own.
 * The opening line stays short on purpose: every caller already hears that
 * an AI is speaking and that the call is recorded and processed; this is the
 * second layer for whoever wants more.
 *
 * Built only from the clinic notice template (Klinik-Aydinlatma-Metni-Sablonu.md)
 * and the retention the site states — no new facts. Numbers are written as
 * words because the voice reads digits badly. `{klinik}` becomes the clinic's
 * name. Turkish only: the agent speaks Turkish only.
 */
export const SPOKEN_PRIVACY_NOTICE =
  "Kişisel verileriniz, veri sorumlusu olarak {klinik} adına işlenir. " +
  "Adınız, telefon numaranız, görüşmede ilettiğiniz talep ve sağlıkla ilgili bilgiler ile görüşmenin ses kaydı ve yazılı dökümü; " +
  "randevunuzu oluşturmak, talebinize dönüş yapmak ve hizmet kalitesi için işlenir. " +
  "Ses kaydı en fazla on dört gün; yazılı döküm, adınız ve telefon numaranız on iki ay saklanır, sonra silinir. " +
  "Ses altyapısı, yapay zekâ ve veri barındırma sağlayıcılarının sunucuları yurt dışında olduğu için verileriniz yurt dışına aktarılır. " +
  "Verileriniz hakkında bilgi isteme, düzeltilmesini ya da silinmesini isteme gibi haklarınız var; bunun için kliniğe başvurabilirsiniz. " +
  "Ayrıntılı aydınlatma metnini klinikten isteyebilirsiniz.";

export function spokenPrivacyNotice(clinicName: string | undefined): string {
  const name = clinicName?.trim() || "klinik";
  return SPOKEN_PRIVACY_NOTICE.replaceAll("{klinik}", name);
}
