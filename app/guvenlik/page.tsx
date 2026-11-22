"use client";

import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";
import { WEB_TRIAL_LIVE } from "@/lib/marketing-flags";
import { LegalDoc, type DocSection } from "@/components/marketing/legal-doc";

// Every claim here must stay true to the code: retention (lib/privacy/retention.ts),
// opening notice (lib/agents/privacy-notice.ts), topic limits (lib/agents/prompt.ts),
// support access log, breach notice (VİS §9 in lib/contracts/text.ts). Don't add
// "we never train models on your data" until the LLM provider's setting is confirmed.
const SECTIONS: DocSection[] = [
  {
    title: { tr: "Roller: kim neden sorumlu", en: "Roles: who is responsible for what" },
    body: [
      {
        tr: "Hastalarınızın aramalarında veri sorumlusu kliniğinizdir; Randevox veri işleyen olarak yalnızca kliniğin talimatıyla çalışır. Bu ilişki, panelde kabul edilen Veri İşleme Sözleşmesi ile yazılı hale getirilir. Arayan verilerini kendi amaçlarımız için kullanmayız, satmayız ve başka bir klinikle paylaşmayız.",
        en: "For your patients' calls, your clinic is the data controller; Randevox acts only on the clinic's instructions as a data processor. This is put in writing in the Data Processing Agreement accepted in the panel. We don't use callers' data for our own purposes, sell it, or share it with any other clinic.",
      },
    ],
  },
  {
    id: "gorusme",
    title: { tr: "Bir görüşmede veriler nasıl işlenir?", en: "How data flows during a call" },
    body: [
      {
        list: [
          { tr: "Arama, kliniğin telefon hattından ses altyapımıza (Vapi) ulaşır. Asistan açılışta yapay zekâ olduğunu ve görüşmenin yazıya döküldüğünü söyler; arayan sorarsa aydınlatma bilgisini telefonda okur.", en: "The call reaches our voice platform (Vapi) from the clinic's phone line. The assistant says up front that it's an AI and the call is transcribed; if the caller asks, it reads the privacy notice on the call." },
          { tr: "Konuşma anlık olarak yazıya çevrilir (Deepgram), yapay zekâ modeli (OpenAI) yanıtı üretir ve yanıt seslendirilir (ElevenLabs).", en: "Speech is transcribed in real time (Deepgram), the AI model (OpenAI) writes the reply, and the reply is voiced (ElevenLabs)." },
          { tr: "Randevu, kliniğin takvimine canlı yazılır; asistan uygun saati takvimden okur.", en: "The appointment is written live into the clinic's calendar; the assistant reads free slots from it." },
          { tr: "Görüşmenin ses kaydı alınmaz. Görüşme bitince transkript ve özet yalnızca o kliniğin panelinde görünür.", en: "Calls are not recorded as audio. When the call ends, the transcript and summary appear only in that clinic's panel." },
        ],
      },
    ],
  },
  {
    title: { tr: "Veriler nerede tutulur?", en: "Where is data stored?" },
    body: [
      {
        tr: "Panel ve çağrı verileri Supabase veritabanında (sunucu Japonya), uygulama Vercel'de (ABD) çalışır; ses altyapısı ve yapay zekâ sağlayıcıları ABD'dedir. Bu nedenle veriler yurt dışına aktarılır. Tüm alt işleyenlerin listesi ve hangi veriyi neden aldıkları Gizlilik Politikası'nın 5. bölümündedir.",
        en: "Panel and call data live in a Supabase database (server in Japan) and the app runs on Vercel (USA); the voice platform and AI providers are in the USA. Data is therefore transferred abroad. The full list of sub-processors, and what each receives and why, is in section 5 of the Privacy Policy.",
      },
    ],
  },
  {
    title: { tr: "Şifreleme", en: "Encryption" },
    body: [
      {
        tr: "Site, panel ve sağlayıcılar arasındaki tüm bağlantılar HTTPS (TLS) ile şifrelenir. Veritabanı sağlayıcımız verileri depolama katmanında da şifreler. Sağlayıcı erişim anahtarları ve kliniğe özel takvim anahtarları sunucu tarafında tutulur; tarayıcıya ve klinik kullanıcılarına hiç gönderilmez.",
        en: "All connections between the site, the panel and our providers are encrypted with HTTPS (TLS). Our database provider also encrypts data at rest. Provider keys and each clinic's calendar keys stay on the server and are never sent to the browser or to clinic users.",
      },
    ],
  },
  {
    title: { tr: "Erişim ve yetkilendirme", en: "Access and authorisation" },
    body: [
      {
        list: [
          { tr: "Her klinik yalnızca kendi verisini görür; bu ayrım veritabanı düzeyindeki erişim kurallarıyla (satır düzeyi güvenlik) sağlanır.", en: "Each clinic sees only its own data; this separation is enforced by row-level security rules in the database." },
          { tr: "Panel hesaplarını, kliniğin istediği personel için biz açarız; herkese açık kayıt yoktur.", en: "We open panel accounts for the staff the clinic names; there is no public sign-up." },
          { tr: "Teknik destek gerektiğinde ekibimiz kliniğin paneline yalnızca sorunu gidermek için girebilir. Bu sırada panelde \"Destek modu\" uyarısı görünür; her erişim tarih, saat ve nedeniyle kaydedilir.", en: "When technical support is needed, our team may enter the clinic's panel only to fix the issue. The panel then shows a \"Support mode\" notice, and every access is logged with its date, time and reason." },
          { tr: "Kart bilgileri Randevox'ta saklanmaz; ödemeler ödeme kuruluşunun bağlantısı üzerinden alınır.", en: "Card details are not stored by Randevox; payments go through the payment provider's link." },
          { tr: "Sistem hatası bildirimlerinde telefon ve e-posta gibi kişisel veriler maskelenir.", en: "Personal data such as phone numbers and email addresses is masked in system error alerts." },
        ],
      },
    ],
  },
  {
    id: "saklama",
    title: { tr: "Saklama ve silme", en: "Retention and deletion" },
    body: [
      {
        list: [
          { tr: "Transkript, özet ve arayanın adı ile telefonu 6 ay sonra silinir; raporlar için yalnızca kişiyle ilişkilendirilemeyen istatistik (tarih, süre, sonuç) kalır.", en: "Transcripts, summaries and the caller's name and number are deleted after 6 months, leaving only non-identifying statistics (date, duration, outcome) for reports." },
          { tr: "Randevu kayıtları, kliniğin takvimi için hesap kapanana kadar tutulur.", en: "Appointment records are kept for the clinic's calendar until the account closes." },
          { tr: "Hesap kapandığında kalan veriler 30 gün içinde kliniğe iade edilir veya silinir. Fatura gibi yasal kayıtlar mevzuattaki süre boyunca saklanır.", en: "When the account closes, remaining data is returned to the clinic or deleted within 30 days. Legal records such as invoices are kept for the period the law requires." },
        ],
      },
    ],
  },
  {
    title: { tr: "Asistanın görüşme kuralları", en: "The assistant's rules on a call" },
    body: [
      {
        list: [
          { tr: "Yalnızca diş ve ağız sağlığı ile klinik konularında konuşur.", en: "It talks only about dental and oral health and the clinic itself." },
          { tr: "Teşhis koymaz, ilaç ve doz önermez, tedavi sonucu garantisi vermez; bunları hekime bırakır.", en: "It doesn't diagnose, recommend drugs or doses, or guarantee treatment results; it leaves these to the dentist." },
          { tr: "Klinik kapalıyken acil bir durum anlatılırsa arayanı 112'ye ve en yakın acil servise yönlendirir.", en: "If an emergency is described while the clinic is closed, it directs the caller to 112 (emergency services) and the nearest A&E." },
          { tr: "Başka hastaların bilgisini asla paylaşmaz. Sözleşme gereği asistanın talimatlarına randevu için gerekenin ötesinde sağlık bilgisi toplayan sorular eklenmez.", en: "It never shares other patients' details. By contract, no questions collecting more health information than a booking needs are added to its instructions." },
          { tr: "Asistan hiçbir zaman dışarıyı aramaz. Geri arama talepleri kliniğe e-postayla iletilir ve aramayı klinik personeli yapar.", en: "The assistant never makes outbound calls. Callback requests are emailed to the clinic and staff call back themselves." },
        ],
      },
    ],
  },
  {
    title: { tr: "Veri ihlali", en: "Data breaches" },
    body: [
      {
        tr: "Klinik verilerini etkileyen bir ihlali öğrendiğimizde kliniği gecikmeksizin ve en geç 24 saat içinde bilgilendiririz; ihlalin niteliğini, etkilenen veriyi ve alınan tedbirleri paylaşırız. Kurul'a ve ilgili kişilere bildirim veri sorumlusu olarak kliniğin yükümlülüğüdür; bunun için gereken bilgileri sağlarız.",
        en: "If we learn of a breach affecting clinic data, we inform the clinic without delay and within 24 hours at the latest, sharing what happened, the data affected and the measures taken. Notifying the Board and affected people is the clinic's duty as data controller; we provide the information it needs.",
      },
    ],
  },
  {
    title: { tr: "KVKK haklarınız", en: "Your KVKK rights" },
    body: [
      {
        tr: "KVKK md. 11 kapsamındaki taleplerinizi info@randevoxai.com adresine iletebilirsiniz; en geç 30 gün içinde ücretsiz yanıtlarız. Bir kliniğin arayanıysanız talebinizi veri sorumlusu olan o kliniğe iletmeniz gerekir; bize ulaşırsa kliniğe yönlendiririz.",
        en: "Send requests under KVKK art. 11 to info@randevoxai.com; we answer free of charge within 30 days. If you called a clinic, send your request to that clinic as the data controller; if it reaches us, we forward it.",
      },
    ],
  },
];

export default function SecurityPage() {
  const { lang } = useLang();
  const tr = lang === "tr";
  return (
    <LegalDoc
      eyebrow={{ tr: "Şirket", en: "Company" }}
      title={{ tr: "Güvenlik ve KVKK", en: "Security & KVKK" }}
      updated={{ tr: "Son güncelleme: 21 Kasım 2026", en: "Last updated: November 21, 2026" }}
      intro={{
        tr: "Kliniğinizin ve hastalarınızın verisini nasıl koruduğumuzu, nerede tuttuğumuzu ve ne zaman sildiğimizi sade bir dille burada anlatıyoruz. Hukuki ayrıntılar Gizlilik Politikası'ndadır.",
        en: "Here, in plain words, is how we protect your clinic's and your patients' data, where we keep it and when we delete it. The legal detail is in the Privacy Policy.",
      }}
      sections={SECTIONS}
    >
      <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-[14px]">
        <Link href="/gizlilik" className="underline underline-offset-2 hover:text-foreground">{tr ? "Gizlilik Politikası" : "Privacy Policy"}</Link>
        {WEB_TRIAL_LIVE && <Link href="/acik-riza" className="underline underline-offset-2 hover:text-foreground">{tr ? "Açık Rıza Metni" : "Explicit Consent Notice"}</Link>}
        <a href="https://www.kvkk.gov.tr" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">{tr ? "Kişisel Verileri Koruma Kurumu" : "Turkish Data Protection Authority"}</a>
      </div>
    </LegalDoc>
  );
}
