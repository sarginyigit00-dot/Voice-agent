import type { Agent } from "@/lib/demo/data";
import { summarizeHours } from "@/lib/agents/hours";
import type { L } from "@/lib/i18n/config";

/**
 * Composes the full instruction block the voice provider needs, out of the
 * pieces a clinic actually edits: its own instructions, the greeting, its
 * working hours, and which actions are enabled.
 *
 * Why this exists as a function rather than one big textarea: three of those
 * four pieces are already structured data the app owns, and re-typing them
 * into a prompt by hand is how they drift. The clinic writes only the part
 * that is genuinely prose — `systemPrompt` — and everything else is derived.
 *
 * The result is what /agents shows under "Tam talimat", ready to paste onto
 * the assistant in the voice provider's dashboard. (Pushing it there
 * automatically needs the provider API, which is a separate piece of work —
 * until then this is the handoff.)
 */
export function composeSystemPrompt(agent: Agent, lang: "tr" | "en" = "tr"): string {
  const t = (l: L) => l[lang];
  const tr = lang === "tr";
  const sections: string[] = [];

  sections.push(
    tr
      ? `# Kimlik\nAdın ${agent.name}. Bir kliniğin telefonunu açan sesli asistansın.\nGörevin: ${t(agent.purpose)}`
      : `# Identity\nYour name is ${agent.name}. You are the voice assistant answering a clinic's phone.\nYour job: ${t(agent.purpose)}`,
  );

  sections.push(
    tr
      ? `# Karşılama\nAramayı tam olarak şu cümleyle aç:\n"${t(agent.greeting)}"`
      : `# Greeting\nOpen the call with exactly this line:\n"${t(agent.greeting)}"`,
  );

  // The clinic's own instructions — the only free-prose part, and the reason
  // an agent can finally be told about services, prices and escalation rules.
  if (agent.systemPrompt?.trim()) {
    sections.push(
      (tr ? "# Klinik talimatları\n" : "# Clinic instructions\n") + agent.systemPrompt.trim(),
    );
  }

  const hours = summarizeHours(agent.workingHours, lang);
  sections.push(
    tr
      ? `# Çalışma saatleri\nKlinik şu saatlerde açık (${agent.workingHours.timeZone}):\n${hours}\n\nBu saatlerin dışına randevu verme. Arayan kapalı bir saat isterse, bunu söyle ve açık olan en yakın saatleri öner.`
      : `# Working hours\nThe clinic is open (${agent.workingHours.timeZone}):\n${hours}\n\nNever book outside these hours. If the caller asks for a closed time, say so and offer the nearest open slots.`,
  );

  if (agent.actionIds.includes("book")) {
    sections.push(
      tr
        ? `# Randevu alma\nRandevu için ASLA saat uydurma. Sırayla:\n1. Uygun saatleri görmek için \`check_availability\` aracını çağır (belirli bir gün soruluyorsa \`date\` parametresini "YYYY-AA-GG" biçiminde ver).\n2. Dönen saatleri arayana oku.\n3. Arayanın seçtiği saati \`book_appointment\` aracına, aracın sana verdiği ISO değeriyle gönder. Adını ve varsa e-postasını da ilet.\n4. Araç başarılı dönerse randevuyu arayana tekrar ederek onayla. Başarısız dönerse uydurma — aracın söylediğini aktar.`
        : `# Booking\nNever invent a time. In order:\n1. Call \`check_availability\` to see real openings (pass \`date\` as "YYYY-MM-DD" when a specific day is asked about).\n2. Read the returned times back to the caller.\n3. Send the time they pick to \`book_appointment\`, using the exact ISO value the tool gave you. Include their name, and email if they gave one.\n4. If the tool succeeds, confirm the appointment back to the caller. If it fails, do not improvise — relay what the tool said.`,
    );
  }

  if (agent.actionIds.includes("transfer")) {
    sections.push(
      tr
        ? `# Transfer\nArayan bir insanla konuşmak isterse, tıbbi bir soru sorarsa ya da sen üst üste iki kez yardımcı olamazsan, canlı temsilciye aktar.`
        : `# Transfer\nHand off to a human when the caller asks for one, asks a medical question, or you have failed to help twice in a row.`,
    );
  }

  sections.push(
    tr
      ? `# Konuşma tarzı\nTelefonda konuşuyorsun: kısa cümleler kur, tek seferde tek soru sor, madde işareti veya emoji kullanma. Arayan hangi dilde konuşuyorsa o dilde devam et. Bilmediğin bir şeyi uydurma — bilmiyorsan söyle ve aktar.`
      : `# Style\nYou are on a phone call: short sentences, one question at a time, no bullet points or emoji. Continue in whatever language the caller uses. Never invent an answer — say you don't know and hand off.`,
  );

  return sections.join("\n\n");
}
