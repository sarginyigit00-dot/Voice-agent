/**
 * A clinic's own facts — services with prices, doctors, address, FAQ — that
 * the voice agent answers from. Edited on /klinik, stored in
 * `clinic_knowledge` (supabase/schema.sql), and folded into every agent's
 * system prompt by lib/agents/prompt.ts on each Vapi sync.
 *
 * Pure (no server or browser imports) so the page, the API route and the
 * prompt builder all share one shape and one validator.
 */

export interface KnowledgeService {
  name: string;
  specialty: string;
  /** Lira; null when the clinic quotes after an examination. */
  price: number | null;
  durationMin: number | null;
  description: string;
}

export interface KnowledgeDoctor {
  /** "Dt.", "Dr.", "Uzm. Dr." … */
  title: string;
  name: string;
  specialty: string;
  notes: string;
}

export interface ClinicKnowledge {
  services: KnowledgeService[];
  doctors: KnowledgeDoctor[];
  address: string;
  faq: string;
}

export const EMPTY_KNOWLEDGE: ClinicKnowledge = { services: [], doctors: [], address: "", faq: "" };

/** Everything lands in the prompt on every call, so it is capped. */
export const KNOWLEDGE_LIMITS = { services: 150, doctors: 60, field: 200, description: 400, address: 500, faq: 4000 };

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function block(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function amount(v: unknown, max: number): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".").trim()) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : null;
}

/** Whatever came from the browser or the database, as a safe, bounded shape. Rows without a name are dropped. */
export function normalizeKnowledge(raw: unknown): ClinicKnowledge {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const L = KNOWLEDGE_LIMITS;

  const services = (Array.isArray(r.services) ? r.services : [])
    .map((s: Record<string, unknown>) => ({
      name: text(s?.name, L.field),
      specialty: text(s?.specialty, L.field),
      price: amount(s?.price, 10_000_000),
      durationMin: amount(s?.durationMin, 1440),
      description: text(s?.description, L.description),
    }))
    .filter((s) => s.name)
    .slice(0, L.services);

  const doctors = (Array.isArray(r.doctors) ? r.doctors : [])
    .map((d: Record<string, unknown>) => ({
      title: text(d?.title, 40),
      name: text(d?.name, L.field),
      specialty: text(d?.specialty, L.field),
      notes: text(d?.notes, L.description),
    }))
    .filter((d) => d.name)
    .slice(0, L.doctors);

  return { services, doctors, address: block(r.address, L.address), faq: block(r.faq, L.faq) };
}

export function isEmptyKnowledge(k: ClinicKnowledge): boolean {
  return !k.services.length && !k.doctors.length && !k.address && !k.faq;
}

/** The "# Klinik bilgileri" block of the system prompt; null when the clinic has entered nothing. */
export function knowledgeSection(k: ClinicKnowledge | null | undefined, lang: "tr" | "en" = "tr"): string | null {
  if (!k || isEmptyKnowledge(k)) return null;
  const tr = lang === "tr";
  const out: string[] = [
    tr
      ? "# Klinik bilgileri\nAşağıdakileri klinik kendisi girdi. Hizmet, fiyat, süre, doktor ve adres sorularını YALNIZCA bunlara göre cevapla. Burada olmayan bir şeyi uydurma: \"Bu konuda kesin bilgim yok, ekibimiz size dönsün\" de. Fiyatı yazılmamış bir hizmete fiyat söyleme. Tıbbi tavsiye ya da teşhis verme."
      : "# Clinic facts\nThe clinic entered these itself. Answer questions about services, prices, durations, doctors and the address ONLY from them. Never invent anything missing here — say you don't have that detail and the team will follow up. Never quote a price that isn't listed. Give no medical advice or diagnosis.",
  ];

  if (k.services.length) {
    out.push(
      (tr ? "## Hizmetler\n" : "## Services\n") +
        k.services
          .map((s) => {
            const facts = [
              s.price !== null ? `${s.price} TL` : tr ? "fiyat muayene sonrası belirlenir" : "priced after an examination",
              s.durationMin !== null ? (tr ? `yaklaşık ${s.durationMin} dakika` : `about ${s.durationMin} minutes`) : null,
            ].filter(Boolean);
            return `- ${s.name}${s.specialty ? ` (${s.specialty})` : ""}: ${facts.join(", ")}${s.description ? `. ${s.description}` : ""}`;
          })
          .join("\n"),
    );
  }

  if (k.doctors.length) {
    out.push(
      (tr ? "## Doktorlar\n" : "## Doctors\n") +
        k.doctors
          .map((d) => `- ${[d.title, d.name].filter(Boolean).join(" ")}${d.specialty ? `: ${d.specialty}` : ""}${d.notes ? `. ${d.notes}` : ""}`)
          .join("\n"),
    );
  }

  if (k.address) out.push((tr ? "## Adres\n" : "## Address\n") + k.address);
  if (k.faq) out.push((tr ? "## Sık sorulanlar\n" : "## FAQ\n") + k.faq);

  return out.join("\n\n");
}

/** What /klinik shows in demo mode — never written anywhere. */
export const DEMO_KNOWLEDGE: ClinicKnowledge = {
  services: [
    { name: "Diş taşı temizliği", specialty: "Periodontoloji", price: 1500, durationMin: 30, description: "" },
    { name: "Kanal tedavisi", specialty: "Endodonti", price: 4000, durationMin: 60, description: "Tek seansta bitmeyebilir." },
    { name: "Diş beyazlatma", specialty: "Estetik diş hekimliği", price: 3500, durationMin: 45, description: "" },
    { name: "İmplant", specialty: "Ağız, diş ve çene cerrahisi", price: null, durationMin: 90, description: "Fiyat muayene ve röntgen sonrası belirlenir." },
  ],
  doctors: [
    { title: "Dt.", name: "Ayşe Kaya", specialty: "Ortodonti", notes: "Salı ve Perşembe günleri klinikte." },
    { title: "Dt.", name: "Mehmet Demir", specialty: "Endodonti", notes: "" },
  ],
  address: "Örnek Mah. Sağlık Cad. No: 12, Kadıköy / İstanbul. Metrobüs durağına 5 dakika yürüme mesafesinde.",
  faq: "Otopark var mı? Binanın önünde ücretsiz otopark var.\nKredi kartı geçiyor mu? Evet, taksit de yapılabiliyor.\nİlk muayene ücretli mi? İlk muayene ücretsizdir.",
};
