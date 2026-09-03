"use client";

import appConfig from "@/app.config";
import { useLang } from "@/components/i18n/language-provider";
import { LegalShell } from "../legal-shell";

type LL = { tr: string; en: string };

const SECTIONS: { title: LL; body: LL[] }[] = [
  {
    title: { tr: "1. Hangi verileri işliyoruz", en: "1. What data we process" },
    body: [
      {
        tr: "Hesap bilgilerinizi (ad, e-posta), kliniğinizin ayarlarını, ajan yapılandırmalarını ve ajanınızın aldığı çağrılara ait arayan bilgilerini (ad, telefon, e-posta), çağrı transkriptlerini, çağrı kayıtlarını (etkinleştirdiyseniz) ve randevu kayıtlarını işleriz.",
        en: "We process your account information (name, email), your clinic's settings, agent configurations, and — for calls your agent handles — caller details (name, phone, email), call transcripts, call recordings (if you enable them), and appointment records.",
      },
    ],
  },
  {
    title: { tr: "2. Sağlık verisi ve KVKK", en: "2. Health data and KVKK" },
    body: [
      {
        tr: "Kliniğiniz sağlık hizmeti verdiği için, arayanların paylaştığı bilgiler özel nitelikli kişisel veri (sağlık verisi) sayılabilir. Bu verilerin işlenmesinden ve arayanlara KVKK kapsamında aydınlatma yapılmasından veri sorumlusu sıfatıyla siz (klinik) sorumlusunuz; biz veri işleyen sıfatıyla sadece sizin talimatlarınız doğrultusunda işleriz. Arama başında okutmak üzere kendi aydınlatma metninizi ajan talimatlarınıza ekleyebilirsiniz.",
        en: "Because your clinic provides healthcare, information callers share may qualify as special-category personal data (health data). As the data controller, your clinic is responsible for processing this data lawfully and informing callers (e.g. under Turkey's KVKK); we act only as a data processor, on your instructions. You can add your own disclosure text to your agent's instructions to be read at the start of a call.",
      },
    ],
  },
  {
    title: { tr: "3. Verileri nasıl kullanıyoruz", en: "3. How we use the data" },
    body: [
      {
        tr: "Verileri yalnızca hizmeti sunmak (çağrıları yanıtlamak, randevu almak, panelinizde göstermek), hizmeti iyileştirmek ve yasal yükümlülüklerimizi yerine getirmek için kullanırız. Verilerinizi satmayız.",
        en: "We use data only to provide the service (answering calls, booking appointments, showing them in your panel), to improve the service, and to meet legal obligations. We do not sell your data.",
      },
    ],
  },
  {
    title: { tr: "4. Kiminle paylaşıyoruz", en: "4. Who we share it with" },
    body: [
      {
        tr: "Hizmeti çalıştırmak için kullandığımız alt işleyicilerle (telefon/ses altyapısı, büyük dil modeli sağlayıcısı, takvim entegrasyonu, veritabanı barındırma) sınırlı ölçüde veri paylaşırız. Kendi CRM entegrasyonunuzu (ör. bir webhook) etkinleştirirseniz, çağrı verileri sizin belirttiğiniz o adrese de gönderilir.",
        en: "We share data on a limited basis with the sub-processors we use to run the service (telephony/voice infrastructure, the LLM provider, calendar integration, database hosting). If you enable your own CRM integration (e.g. a webhook), call data is also sent to the address you specify.",
      },
    ],
  },
  {
    title: { tr: "5. Saklama süresi", en: "5. Retention" },
    body: [
      {
        tr: "Çağrı kayıtları, transkriptler ve randevu verileri hesabınızda, siz silene kadar veya hesabınızı kapatana kadar tutulur. Saklama süresini kendi panelinizden yönetebilirsiniz.",
        en: "Call recordings, transcripts and appointment data are kept in your account until you delete them or close your account. You can manage retention from your own panel.",
      },
    ],
  },
  {
    title: { tr: "6. Haklarınız", en: "6. Your rights" },
    body: [
      {
        tr: `Verilerinize erişim, düzeltme ve silme talep etme hakkına sahipsiniz. Talepleriniz için ${appConfig.domain} üzerinden bize ulaşabilirsiniz. Klinik müşterilerimizin kendi arayanlarına karşı KVKK/GDPR yükümlülükleri ayrıca geçerlidir.`,
        en: `You have the right to access, correct, or request deletion of your data. Reach us via ${appConfig.domain} for such requests. Our clinic customers' own KVKK/GDPR obligations toward their callers apply separately.`,
      },
    ],
  },
  {
    title: { tr: "7. Güvenlik", en: "7. Security" },
    body: [
      {
        tr: "Verileriniz erişim kontrolü ve şifreli bağlantılar (HTTPS) ile korunur. Hiçbir sistem %100 güvenli değildir; bir ihlal durumunda yasal yükümlülüklerimiz doğrultusunda bilgilendirme yaparız.",
        en: "Your data is protected with access controls and encrypted connections (HTTPS). No system is 100% secure; in the event of a breach we will notify as required by law.",
      },
    ],
  },
];

export default function V2PrivacyPage() {
  const { lang } = useLang();
  const tt = (v: LL) => v[lang];

  return (
    <LegalShell>
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="font-mono-nums text-[11px] uppercase tracking-wider text-muted-foreground">
          {lang === "tr" ? "Yasal" : "Legal"}
        </p>
        <h1 className="mt-2 font-editorial text-4xl">{lang === "tr" ? "Gizlilik Politikası" : "Privacy Policy"}</h1>
        <p className="mt-3 text-[13px] text-muted-foreground">
          {lang === "tr" ? "Son güncelleme: 30 Ağustos 2026" : "Last updated: August 30, 2026"}
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title.en} id={s.title.en === "2. Health data and KVKK" ? "kvkk" : undefined}>
              <h2 className="text-[15px] font-semibold text-foreground">{tt(s.title)}</h2>
              <div className="mt-2 space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="text-[14px] leading-relaxed text-muted-foreground">
                    {tt(p)}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </LegalShell>
  );
}
