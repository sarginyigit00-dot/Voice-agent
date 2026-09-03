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
  tagline: { tr: "İnsan gibi konuşan, hiçbir aramayı kaçırmayan AI telefon ajanları.", en: "AI phone agents that sound human and never miss a call." },
  description: {
    tr: "Randevox, telefonu açan, randevu alan, müşteri adaylarını nitelendiren ve yönlendiren AI sesli telefon ajanlarıdır — 7/24. Bir numara al, ajanını tarif et, gerisini o halletsin. Hepsi tek karanlık bir kokpitte.",
    en: "Randevox is AI voice phone agents that answer calls, book appointments, qualify leads and route them — 24/7. Get a number, describe your agent, and let it handle the rest. All in one dark cockpit.",
  },
  domain: "randevoxai.com",
  logoText: "R",
  accentName: "blue",

  marketing: {
    badge: { tr: "Kaçan arama, kaçan hastadır.", en: "A missed call is a missed patient." },
    heroTitle: {
      tr: "İnsan gibi konuşan AI telefon ajanları,",
      en: "AI phone agents that sound human,",
    },
    heroAccent: {
      tr: "hiçbir aramayı kaçırmaz.",
      en: "and never miss a call.",
    },
    heroSubtitle: {
      tr: "Randevox telefonu ilk çalışta açar, randevu alır, müşteri adaylarını nitelendirir ve doğru kişiye yönlendirir — gece, hafta sonu, yoğunken bile. Bir numara al, ajanını dakikalar içinde kur.",
      en: "Randevox answers on the first ring, books appointments, qualifies leads and routes them to the right person — nights, weekends, even when you're slammed. Get a number and launch your agent in minutes.",
    },
    heroCtaPrimary: { tr: "Bir numara al", en: "Get a number" },
    heroCtaSecondary: { tr: "Canlı demoyu dinle", en: "Hear the live demo" },
    features: [
      { icon: "audio-lines", title: { tr: "İnsan gibi sesler", en: "Human-like voices" }, body: { tr: "Düşük gecikmeli, doğal duraklamalı ve araya girilebilen sesler. Arayanlar bir bot ile konuştuklarını çoğu zaman fark etmez.", en: "Low-latency, natural-sounding voices with real pauses and barge-in. Most callers never realize they're talking to a bot." } },
      { icon: "calendar-check", title: { tr: "Randevu alır", en: "Books appointments" }, body: { tr: "Takvimine canlı bağlanır, uygunluğu okur, slot teklif eder ve aramayı kapatmadan rezervasyonu onaylar.", en: "Connects live to your calendar, reads availability, offers slots and confirms the booking before the call ends." } },
      { icon: "filter", title: { tr: "Müşteri adayını nitelendirir", en: "Qualifies leads" }, body: { tr: "Senin sorularını sorar, yanıtları puanlar ve yalnızca ciddi adayları sana iletir. Gerisini kayda geçirip bekletir.", en: "Asks your questions, scores the answers and passes only serious leads to you. The rest are logged and kept for later." } },
      { icon: "clock", title: { tr: "7/24 açık", en: "24/7 coverage" }, body: { tr: "Mesai dışı, tatil, pik saatler — fark etmez. Her arama anında karşılanır, hiçbiri sesli mesaja düşmez.", en: "After hours, holidays, peak load — it doesn't matter. Every call is answered instantly; none drop to voicemail." } },
      { icon: "languages", title: { tr: "Çok dilli", en: "Multi-language" }, body: { tr: "Türkçe, İngilizce ve 30+ dil. Ajan arayanın dilini algılar ve aynı dilde sorunsuz devam eder.", en: "Turkish, English and 30+ languages. The agent detects the caller's language and continues seamlessly in it." } },
      { icon: "workflow", title: { tr: "CRM senkronu", en: "CRM sync" }, body: { tr: "Her arama özet, transkript ve eylem maddeleriyle müşteri kaydına düşer. Kimin ne sorduğunu sonradan okuyabilirsin.", en: "Every call lands on the customer record with a summary, transcript and action items — so you can read later who asked what." } },
    ],
    stats: [
      { value: "7/24", label: { tr: "kesintisiz açık hat", en: "line that always answers" } },
      { value: "30+", label: { tr: "konuşulan dil", en: "languages spoken" } },
      { value: "İlk çalışta", label: { tr: "telefonu açar", en: "answers, on the first ring" } },
      { value: "0", label: { tr: "sesli mesaja düşen arama", en: "calls dropped to voicemail" } },
    ],
    pricing: [
      { name: "Starter", price: "$0", period: "/mo", tagline: { tr: "Bir ajanı ücretsiz dene.", en: "Try one agent, free." }, features: [{ tr: "1 sesli ajan", en: "1 voice agent" }, { tr: "Ayda 60 dakika", en: "60 minutes / month" }, { tr: "1 telefon numarası", en: "1 phone number" }, { tr: "Transkript & özet", en: "Transcripts & summaries" }], cta: { tr: "Ücretsiz başla", en: "Start free" } },
      { name: "Growth", price: "$99", period: "/mo", tagline: { tr: "Büyüyen ekipler için.", en: "For growing teams." }, features: [{ tr: "Starter'daki her şey", en: "Everything in Starter" }, { tr: "5 sesli ajan", en: "5 voice agents" }, { tr: "Ayda 2.000 dakika", en: "2,000 minutes / month" }, { tr: "Takvim & CRM senkronu", en: "Calendar & CRM sync" }, { tr: "Çağrı yönlendirme & transfer", en: "Call routing & transfer" }], cta: { tr: "Growth'a geç", en: "Go Growth" }, featured: true },
      { name: "Scale", price: "$399", period: "/mo", tagline: { tr: "Yüksek hacimli operasyonlar için.", en: "For high-volume ops." }, features: [{ tr: "Growth'taki her şey", en: "Everything in Growth" }, { tr: "Sınırsız ajan", en: "Unlimited agents" }, { tr: "Ayda 12.000 dakika", en: "12,000 minutes / month" }, { tr: "Özel ses & ince ayar", en: "Custom voice & fine-tuning" }, { tr: "WebSocket & REST API", en: "WebSocket & REST API" }, { tr: "Özel destek", en: "Dedicated support" }], cta: { tr: "Satışa ulaş", en: "Contact sales" } },
    ],
    faq: [
      { q: { tr: "Ajan gerçekten insan gibi mi konuşuyor?", en: "Does the agent really sound human?" }, a: { tr: "Evet. Düşük gecikmeli akışlı sesler, doğal duraklamalar ve araya girme (barge-in) desteği var. Arayan ajanın sözünü kesebilir, ajan da uyum sağlar — donuk bir IVR menüsü gibi değil.", en: "Yes. It uses low-latency streaming voices with natural pauses and barge-in support, so callers can interrupt and the agent adapts — nothing like a clunky IVR menu." } },
      { q: { tr: "Randevuyu nasıl alıyor?", en: "How does it book appointments?" }, a: { tr: "Ajan, kullandığınız takvime (Google Takvim dahil) canlı bağlanır, gerçek uygunluğu okur, arayana slot teklif eder ve aramayı kapatmadan randevuyu onaylayıp davet gönderir.", en: "The agent connects live to the calendar you already use (Google Calendar included), reads real availability, offers slots to the caller and confirms the booking — sending the invite before the call ends." } },
      { q: { tr: "Bir aramayı insana aktarabilir mi?", en: "Can it transfer a call to a human?" }, a: { tr: "Evet. Kuralı sen koyarsın — belirli niyetler, sıcak adaylar veya bir anahtar ifade — Randevox aramayı canlı olarak doğru ekibe veya kişiye transfer eder, bağlamı da yanında taşır.", en: "Yes. You set the rules — certain intents, hot leads or a keyphrase — and Randevox warm-transfers the call live to the right team or person, carrying the context with it." } },
      { q: { tr: "Hangi diller destekleniyor?", en: "Which languages are supported?" }, a: { tr: "Türkçe ve İngilizce dahil 30+ dil. Ajan arayanın dilini ilk cümlelerden algılar ve aynı dilde devam eder.", en: "30+ languages including Turkish and English. The agent detects the caller's language from the first sentences and continues in it." } },
      { q: { tr: "CRM'ime veya araçlarıma bağlanır mı?", en: "Does it connect to my CRM or tools?" }, a: { tr: "Evet — her arama özet, transkript ve çıkarılan eylem maddeleriyle panelinizdeki müşteri kaydına düşer. Kendi CRM'inizi kullanıyorsanız oraya da aktarabiliriz.", en: "Yes — every call lands on the customer record in your panel with a summary, transcript and extracted action items. If you already use your own CRM, we can forward it there too." } },
    ],
  },

  nav: [
    { label: { tr: "Kokpit", en: "Cockpit" }, href: "/dashboard", icon: "radio" },
    { label: { tr: "Aramalar", en: "Calls" }, href: "/calls", icon: "phone" },
    { label: { tr: "Randevular", en: "Appointments" }, href: "/randevular", icon: "calendar-check" },
    { label: { tr: "Ajanlar", en: "Agents" }, href: "/agents", icon: "bot" },
    { label: { tr: "CRM", en: "CRM" }, href: "/crm", icon: "database" },
    { label: { tr: "Ayarlar", en: "Settings" }, href: "/settings", icon: "settings" },
  ],

  integrations: [
    {
      key: "vapi",
      name: "Vapi (Voice)",
      envVars: ["VAPI_API_KEY", "VAPI_PHONE_NUMBER_ID"],
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
