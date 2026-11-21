"use client";

import { LegalDoc, type DocSection } from "@/components/marketing/legal-doc";

// The consent sentence in §5 must stay word-for-word the same as the checkbox in
// components/marketing/try-call.tsx. Change both together.
const SECTIONS: DocSection[] = [
  {
    title: { tr: "1. Bu metin neyi kapsar", en: "1. What this notice covers" },
    body: [
      {
        tr: "Bu Açık Rıza Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, randevoxai.com üzerinde tarayıcınızın mikrofonuyla yaptığınız sesli deneme görüşmeleri içindir: ana sayfadaki \"Ajanla şimdi konuşun\" bölümü ve kliniğinize özel deneme linki (randevoxai.com/dene/…). Görüşmeyi başlatmadan önce bu metni ve Gizlilik Politikası'nı okuyabilirsiniz.",
        en: "This Explicit Consent Notice, under Turkey's Personal Data Protection Law No. 6698 (KVKK), covers the voice trial calls you make with your browser's microphone on randevoxai.com: the \"Talk to the agent now\" section on the home page and your clinic's own trial link (randevoxai.com/dene/…). You can read this notice and the Privacy Policy before starting a call.",
      },
      {
        tr: "Şunları kapsamaz: klinik hesabınız ve panel kullanımınız (bunlar sözleşmenin ifası gibi açık rıza gerektirmeyen sebeplere dayanır) ve bir kliniğin telefon hattını arayan hastaların görüşmeleri (bunlarda veri sorumlusu o kliniktir).",
        en: "It does not cover your clinic account and panel use (these rely on grounds such as performing the contract, which need no consent), nor calls patients make to a clinic's phone line (for those the clinic is the data controller).",
      },
    ],
  },
  {
    title: { tr: "2. İşlenen veriler", en: "2. Data processed" },
    body: [
      {
        list: [
          { tr: "Sesiniz ve görüşmede söyledikleriniz: yalnızca görüşme süresince, anlık olarak yazıya çevrilir, yapay zekâ modeline iletilir ve asistanın yanıtı seslendirilir.", en: "Your voice and what you say on the call: transcribed in real time, passed to the AI model and answered in a synthetic voice, only for the length of the call." },
          { tr: "Görüşme kaydedilmez; ses kaydı ve transkript panelimize ya da herhangi bir kliniğe aktarılmaz.", en: "The call isn't recorded; no recording or transcript is passed to our panel or to any clinic." },
          { tr: "Kliniğe özel deneme linkinde, deneme hakkını saymak için her aramanın kimliği ve süresi tutulur.", en: "On a clinic trial link, each call's ID and length are kept to count the trial allowance." },
        ],
      },
      {
        tr: "Kötüye kullanımı sınırlamak için her görüşme başlangıcında IP adresinizin geri çevrilemez bir özeti tutulur. Bu, açık rızaya değil meşru menfaate (KVKK md. 5/2-f) dayanır ve 30 gün sonra silinir.",
        en: "To limit abuse, a one-way digest of your IP address is stored at each call start. This rests on legitimate interest (KVKK art. 5/2-f), not consent, and is deleted after 30 days.",
      },
    ],
  },
  {
    title: { tr: "3. Amaç", en: "3. Purpose" },
    body: [
      {
        tr: "Bu veriler yalnızca Randevox asistanını sizin denemeniz, yani görüşmenin gerçekleşmesi için işlenir. Pazarlama, profil çıkarma veya başka bir amaçla kullanılmaz.",
        en: "This data is processed only so you can try the Randevox assistant, that is, so the call can take place. It isn't used for marketing, profiling or any other purpose.",
      },
    ],
  },
  {
    title: { tr: "4. Yurt dışına aktarım ve olası riskler", en: "4. Transfer abroad and possible risks" },
    body: [
      {
        tr: "Görüşme, sunucuları ABD'de bulunan şu hizmet sağlayıcılar üzerinden yürür: Vapi (ses ve telefon altyapısı), Deepgram (konuşmayı yazıya çevirme), OpenAI (yapay zekâ modeli) ve ElevenLabs (ses üretimi). Bu nedenle sesiniz görüşme süresince yurt dışına aktarılır. Bu aktarım için KVKK md. 9/6-a uyarınca, muhtemel riskler hakkında bilgilendirilmiş olarak açık rızanızı istiyoruz. Olası riskler:",
        en: "The call runs through these providers, whose servers are in the USA: Vapi (voice and telephony), Deepgram (speech-to-text), OpenAI (AI model) and ElevenLabs (voice). Your voice is therefore transferred abroad for the length of the call. Under KVKK art. 9/6-a we ask for your explicit consent to this transfer after informing you of the possible risks:",
      },
      {
        list: [
          { tr: "ABD hakkında Kişisel Verileri Koruma Kurulu'nun verdiği bir yeterlilik kararı yoktur; oradaki koruma düzeyi Türkiye'dekinden farklı olabilir.", en: "Turkey's Personal Data Protection Board has issued no adequacy decision for the USA; the level of protection there may differ from Türkiye's." },
          { tr: "Haklarınızı o ülkede kullanmak veya oradaki kurumlara başvurmak daha zor olabilir.", en: "Exercising your rights or applying to authorities in that country may be harder." },
          { tr: "Yabancı kamu makamları, kendi mevzuatları çerçevesinde verilere erişim talep edebilir.", en: "Foreign public authorities may request access to data under their own laws." },
        ],
      },
      {
        tr: "Bu riskleri azaltmak için görüşmede gerçek sağlık bilgisi, kimlik numarası veya ödeme bilgisi paylaşmamanızı rica ederiz. Asistan kurgusal bir klinik adına konuşur.",
        en: "To reduce these risks, please don't share real health information, ID numbers or payment details on the call. The assistant speaks for a fictional clinic.",
      },
    ],
  },
  {
    title: { tr: "5. Rıza beyanı", en: "5. Consent statement" },
    body: [
      {
        tr: "Görüşmeyi başlatmadan önce işaretlediğiniz kutu şu beyanı içerir; kutu önceden işaretli gelmez:",
        en: "The box you tick before starting a call carries this statement; it is never pre-ticked:",
      },
      {
        tr: "\"Sesimin görüşme süresince yurt dışındaki ses ve yapay zekâ hizmet sağlayıcılarında anlık işlenmesine açık rıza veriyorum. Görüşme kaydedilmez.\"",
        en: "\"I explicitly consent to my voice being processed in real time by voice and AI providers abroad for the length of the call. The call isn't recorded.\"",
      },
      {
        tr: "Rıza vermek tamamen isteğe bağlıdır. Rıza vermezseniz görüşme başlamaz; bunun yerine sayfadaki örnek görüşmeleri dinleyebilir veya demo talep formu üzerinden ekibimizle görüşebilirsiniz.",
        en: "Consent is entirely optional. Without it the call doesn't start; you can listen to the sample calls on the page instead, or talk to our team through the demo-request form.",
      },
    ],
  },
  {
    title: { tr: "6. Rızanın geri alınması ve haklarınız", en: "6. Withdrawing consent and your rights" },
    body: [
      {
        tr: "Rızanızı istediğiniz an görüşmeyi kapatarak geri alabilirsiniz; işleme o anda durur. Geri alma, o ana kadar yapılan işlemenin hukuka uygunluğunu etkilemez. Görüşme kaydedilmediği için sonradan silinecek bir ses kaydı kalmaz.",
        en: "You can withdraw consent at any moment by ending the call; processing stops then. Withdrawal doesn't affect the lawfulness of processing up to that point. Because the call isn't recorded, no recording remains to be deleted afterwards.",
      },
      {
        tr: "KVKK md. 11 kapsamındaki haklarınız ve başvuru yolu Gizlilik Politikası'nın 7. bölümünde yer alır. Sorularınız için: info@randevoxai.com",
        en: "Your rights under KVKK art. 11 and how to apply are in section 7 of the Privacy Policy. Questions: info@randevoxai.com",
      },
    ],
  },
];

export default function ConsentPage() {
  return (
    <LegalDoc
      title={{ tr: "Açık Rıza Metni", en: "Explicit Consent Notice" }}
      updated={{ tr: "Son güncelleme: 21 Kasım 2026", en: "Last updated: November 21, 2026" }}
      sections={SECTIONS}
    />
  );
}
