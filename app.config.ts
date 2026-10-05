/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  app.config.ts — the single source of truth for this starter.            │
 * │                                                                          │
 * │  Every user-facing string is bilingual: { tr: "...", en: "..." }.        │
 * │  The guided setup (run `/setup`, or say "bu projeyi kur") edits this      │
 * │  file plus app/globals.css and .env.local.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { L } from "@/lib/i18n/config";

export type IconName = string;

export interface NavItem {
  label: L;
  href: string;
  icon: IconName;
}

export interface Feature {
  icon: IconName;
  title: L;
  body: L;
}

export interface Stat {
  value: string;
  label: L;
}

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  tagline: L;
  features: L[];
  cta: L;
  featured?: boolean;
  /** Small label pinned to the card's top edge, e.g. "En çok tercih edilen". */
  badge?: L;
}

export interface FaqItem {
  q: L;
  a: L;
}

export interface Integration {
  key: string;
  name: string;
  envVars: string[];
  /** When true, ANY one of envVars being set counts as connected (alternative keys, e.g. OpenAI OR Anthropic) instead of requiring ALL of them. */
  anyOf?: boolean;
  /** Extra keys that unlock more of the integration but are never needed for it to count as connected (e.g. forwarding to an external CRM on top of the internal one). */
  optionalEnvVars?: string[];
  required: boolean;
  docsUrl: string;
  purpose: L;
}

export interface AppConfig {
  name: string;
  tagline: L;
  description: L;
  domain: string;
  logoText: string;
  accentName: string;
  marketing: {
    badge: L;
    heroTitle: L;
    /** Serif-italic accent line shown under the hero title. */
    heroAccent: L;
    heroSubtitle: L;
    heroCtaPrimary: L;
    heroCtaSecondary: L;
    features: Feature[];
    stats: Stat[];
    pricing: PricingTier[];
    faq: FaqItem[];
  };
  nav: NavItem[];
  integrations: Integration[];
}

export const appConfig: AppConfig = {
  name: "Randevox",
  tagline: { tr: "Diş klinikleri için, hiçbir aramayı kaçırmayan AI telefon ajanı.", en: "The AI phone agent for dental clinics that never misses a call." },
  description: {
    tr: "Randevox, diş kliniklerinin telefonunu 7/24 açan, implant ve estetik görüşmelerini randevuya çeviren, hasta adaylarını nitelendiren ve doğru kişiye yönlendiren AI sesli telefon ajanıdır. Hekimleriniz koltuktayken hiçbir arama kaçmaz.",
    en: "Randevox is an AI voice phone agent for dental clinics: it answers 24/7, turns implant and aesthetic enquiries into bookings, qualifies patient leads and routes them to the right person. While your dentists are chairside, no call is missed.",
  },
  domain: "randevoxai.com",
  logoText: "R",
  accentName: "blue",

  marketing: {
    badge: { tr: "Kaçan arama, kaçan implanttır.", en: "A missed call is a missed implant." },
    heroTitle: {
      tr: "Diş kliniğinizin telefonunu açan AI ajan,",
      en: "The AI agent that answers your dental clinic's phone,",
    },
    heroAccent: {
      tr: "hiçbir hastayı kaçırmaz.",
      en: "and never misses a patient.",
    },
    heroSubtitle: {
      tr: "Randevox telefonu ilk çalışta açar, implant ve estetik görüşmelerini randevuya çevirir, hasta adaylarını nitelendirir ve doğru kişiye yönlendirir — gece, hafta sonu, hekimleriniz koltuktayken bile.",
      en: "Randevox answers on the first ring, turns implant and aesthetic enquiries into bookings, qualifies patient leads and routes them to the right person — nights, weekends, even while your dentists are chairside.",
    },
    heroCtaPrimary: { tr: "Kliniğinizde deneyin", en: "Try it in your clinic" },
    heroCtaSecondary: { tr: "Canlı demoyu dinle", en: "Hear the live demo" },
    features: [
      { icon: "audio-lines", title: { tr: "İnsan gibi sesler", en: "Human-like voices" }, body: { tr: "Düşük gecikmeli, doğal duraklamalı ve araya girilebilen sesler. Arayanlar bir bot ile konuştuklarını çoğu zaman fark etmez.", en: "Low-latency, natural-sounding voices with real pauses and barge-in. Most callers never realize they're talking to a bot." } },
      { icon: "calendar-check", title: { tr: "Randevu alır", en: "Books appointments" }, body: { tr: "Takvimine canlı bağlanır, uygunluğu okur, slot teklif eder ve aramayı kapatmadan rezervasyonu onaylar.", en: "Connects live to your calendar, reads availability, offers slots and confirms the booking before the call ends." } },
      { icon: "filter", title: { tr: "Hasta adayını nitelendirir", en: "Qualifies patient leads" }, body: { tr: "Hangi tedaviyi, kaç diş için, ne zaman istediğini sorar ve yalnızca ciddi implant ve estetik adaylarını hasta danışmanınıza iletir.", en: "Asks which treatment, for how many teeth and when, and passes only serious implant and aesthetic leads to your patient coordinator." } },
      { icon: "clock", title: { tr: "7/24 açık", en: "24/7 coverage" }, body: { tr: "Mesai dışı, tatil, hekimlerin koltukta olduğu yoğun saatler — fark etmez. Her arama anında karşılanır, hiçbiri sesli mesaja düşmez.", en: "After hours, holidays, dentists busy chairside — it doesn't matter. Every call is answered instantly; none drop to voicemail." } },
      { icon: "workflow", title: { tr: "Hasta kaydı", en: "Patient records" }, body: { tr: "Her arama özet, transkript ve eylem maddeleriyle hasta kaydına düşer. Kimin hangi tedaviyi sorduğunu sonradan okuyabilirsiniz.", en: "Every call lands on the patient record with a summary, transcript and action items — so you can read later who asked about which treatment." } },
    ],
    stats: [
      { value: "7/24", label: { tr: "kesintisiz açık hat", en: "line that always answers" } },
      { value: "İlk çalışta", label: { tr: "telefonu açar", en: "answers, on the first ring" } },
      { value: "0", label: { tr: "sesli mesaja düşen arama", en: "calls dropped to voicemail" } },
    ],
    // Turnkey packages (lib/admin/constants.ts PLANS holds the same prices and minutes).
    // Shown on the landing page's #fiyatlar section (app/page.tsx → Pricing).
    pricing: [
      { name: "Klinik", price: "$499", period: "/mo", tagline: { tr: "3–5 hekimli implant ve estetik odaklı klinikler için. Telefonu baştan sona ajan yönetir.", en: "For 3–5 dentist implant and aesthetic clinics. The agent runs the whole phone line." }, features: [{ tr: "Ayda 1.000 dakika", en: "1,000 minutes / month" }, { tr: "7/24 telefon karşılama: tüm hat ya da sadece meşgul / mesai dışı", en: "24/7 answering: the whole line, or only when busy / after hours" }, { tr: "Takvime gerçek randevu", en: "Real bookings into your calendar" }, { tr: "Ses kaydı, transkript ve özet", en: "Recording, transcript and summary" }, { tr: "Randevusuz aramada kliniğe e-posta", en: "Email to the clinic when a call ends without a booking" },{ tr: "Canlı aktarma: ajanın çözemediği ya da yetkili isteyen arama size bağlanır", en: "Live transfer: calls the agent can't resolve, or that ask for a person, reach you" }, { tr: "Mesai dışı için ayrı ajan", en: "A separate after-hours agent" }, { tr: "Dahili CRM", en: "Built-in CRM" }, { tr: "Aylık performans raporu", en: "Monthly performance report" }, { tr: "Aşım: dakikası 0,30 $", en: "Overage: $0.30 / minute" }], cta: { tr: "Demo talep et", en: "Request a demo" }, featured: true, badge: { tr: "En çok tercih edilen", en: "Most popular" } },
      { name: "Poliklinik", price: "$899", period: "/mo", tagline: { tr: "6+ hekimli diş poliklinikleri ve ADSM'ler için. Yoğun hat, bol dakika.", en: "For dental polyclinics with 6+ dentists. A busy line, plenty of minutes." }, features: [{ tr: "Ayda 2.500 dakika", en: "2,500 minutes / month" }, { tr: "Klinik paketindeki her şey", en: "Everything in Klinik" }, { tr: "Haftalık performans raporu (e-posta)", en: "Weekly performance report by email" }, { tr: "Kendi CRM / klinik yazılımınıza canlı aktarım", en: "Live feed into your own CRM / clinic software" }, { tr: "Öncelikli destek", en: "Priority support" }, { tr: "Aylık optimizasyon görüşmesi", en: "Monthly optimisation call" }, { tr: "Aşım: dakikası 0,30 $", en: "Overage: $0.30 / minute" }], cta: { tr: "Demo talep et", en: "Request a demo" }, badge: { tr: "Yoğun hatlar için", en: "For busy lines" } },
    ],
    faq: [
      { q: { tr: "Ajan gerçekten insan gibi mi konuşuyor?", en: "Does the agent really sound human?" }, a: { tr: "Evet. Düşük gecikmeli akışlı sesler, doğal duraklamalar ve araya girme (barge-in) desteği var. Arayan ajanın sözünü kesebilir, ajan da uyum sağlar — donuk bir IVR menüsü gibi değil.", en: "Yes. It uses low-latency streaming voices with natural pauses and barge-in support, so callers can interrupt and the agent adapts — nothing like a clunky IVR menu." } },
      { q: { tr: "Randevuyu nasıl alıyor?", en: "How does it book appointments?" }, a: { tr: "Ajan, kullandığınız takvime (Google Takvim dahil) canlı bağlanır, hekimlerin gerçek uygunluğunu okur, arayana slot teklif eder ve aramayı kapatmadan randevuyu onaylayıp davet gönderir.", en: "The agent connects live to the calendar you already use (Google Calendar included), reads your dentists' real availability, offers slots to the caller and confirms the booking — sending the invite before the call ends." } },
      { q: { tr: "Bir aramayı insana aktarabilir mi?", en: "Can it transfer a call to a human?" }, a: { tr: "Evet. Kuralı siz koyarsınız — tedavi sonrası şikâyet, acil durum, sıcak implant adayı veya bir anahtar ifade — Randevox aramayı canlı olarak doğru kişiye transfer eder, bağlamı da yanında taşır.", en: "Yes. You set the rules — a post-treatment complaint, an emergency, a hot implant lead or a keyphrase — and Randevox warm-transfers the call live to the right person, carrying the context with it." } },
      { q: { tr: "CRM'ime veya araçlarıma bağlanır mı?", en: "Does it connect to my CRM or tools?" }, a: { tr: "Evet — her arama özet, transkript ve çıkarılan eylem maddeleriyle panelinizdeki hasta kaydına düşer. Kendi CRM'inizi veya klinik yazılımınızı kullanıyorsanız oraya da aktarabiliriz.", en: "Yes — every call lands on the patient record in your panel with a summary, transcript and extracted action items. If you already use your own CRM or clinic software, we can forward it there too." } },
    ],
  },

  nav: [
    { label: { tr: "Kokpit", en: "Cockpit" }, href: "/dashboard", icon: "radio" },
    { label: { tr: "Aramalar", en: "Calls" }, href: "/calls", icon: "phone" },
    { label: { tr: "Randevular", en: "Appointments" }, href: "/randevular", icon: "calendar-check" },
    { label: { tr: "Ajanlar", en: "Agents" }, href: "/agents", icon: "bot" },
    { label: { tr: "Klinik", en: "Clinic" }, href: "/klinik", icon: "stethoscope" },
    { label: { tr: "CRM", en: "CRM" }, href: "/crm", icon: "database" },
    { label: { tr: "Ayarlar", en: "Settings" }, href: "/settings", icon: "settings" },
  ],

  integrations: [
    {
      key: "vapi",
      name: "Vapi (Voice)",
      envVars: ["VAPI_API_KEY", "VAPI_WEBHOOK_SECRET"],
      required: false,
      docsUrl: "https://docs.vapi.ai/api-reference",
      purpose: {
        tr: "Telefon hattı + gerçek zamanlı ses — gelen aramaları açar, sesi akıtır ve ajanı çalıştırır. Bağlı değilken aramalar demo verisinden oynatılır.",
        en: "Telephony + realtime voice — answers inbound calls, streams audio and drives the agent. Without it, calls replay from demo data.",
      },
    },
    {
      key: "twilio",
      name: "Twilio",
      envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
      required: false,
      docsUrl: "https://www.twilio.com/console",
      purpose: {
        tr: "Telefon numaraları, SMS ve arama yönlendirme/transfer. Bağlı değilken numaralar ve transferler demo modda simüle edilir.",
        en: "Phone numbers, SMS and call routing/transfer. Without it, numbers and transfers are simulated in demo mode.",
      },
    },
    {
      key: "openai",
      name: "LLM (OpenAI / Anthropic)",
      envVars: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
      anyOf: true,
      required: false,
      docsUrl: "https://platform.openai.com/api-keys",
      purpose: {
        tr: "Beyin — arayanı anlar, ajan talimatını izler ve eylemlere karar verir. Bağlı değilken demo ajan hazır transkriptleri kullanır.",
        en: "The brain — understands the caller, follows the agent prompt and decides actions. Without it, the demo agent uses scripted transcripts.",
      },
    },
    {
      key: "calendar",
      name: "Calendar (Cal.com / Google)",
      envVars: ["CALCOM_API_KEY"],
      required: false,
      docsUrl: "https://cal.com/docs/api-reference",
      purpose: {
        tr: "Canlı uygunluk + rezervasyon; ajan takvime gerçek randevu yazabilir. Bağlı değilken randevular taklit edilir.",
        en: "Live availability + booking so the agent can put real appointments on the calendar. Without it, bookings are mocked.",
      },
    },
    {
      key: "crm",
      name: "CRM",
      // The internal CRM is what "connected" means here — it writes to
      // crm_records in Supabase with the service role key. Forwarding to an
      // external CRM is a bonus on top, never a requirement.
      envVars: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      optionalEnvVars: ["CRM_WEBHOOK_URL"],
      required: false,
      docsUrl: "https://zapier.com/apps/webhook/integrations",
      purpose: {
        tr: "Biten her arama — arayan, özet ve tam transkript — kendi CRM'imize (Supabase `crm_records`) kaydedilir ve /crm sayfasında görünür. CRM_WEBHOOK_URL de verirseniz aynı kayıt ayrıca harici bir CRM'e (Zapier/Make/n8n) POST edilir.",
        en: "Every finished call — caller, summary and full transcript — is logged to our own CRM (Supabase `crm_records`) and shows up on /crm. Set CRM_WEBHOOK_URL too and the same record is additionally POSTed to an external CRM (Zapier/Make/n8n).",
      },
    },
    {
      key: "supabase",
      name: "Supabase",
      envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      required: false,
      docsUrl: "https://supabase.com/dashboard/project/_/settings/api",
      purpose: {
        tr: "Hesaplar, ajanlar, arama geçmişi, transkriptler ve dahili CRM kayıtları (crm_records — bkz. supabase/schema.sql). Bağlı değilken giriş demo modda çalışır ve veriler yereldedir.",
        en: "Accounts, agents, call history, transcripts and the internal CRM log (crm_records — see supabase/schema.sql). Without it, auth runs in demo bypass and data is local.",
      },
    },
  ],
};

export default appConfig;
