"use client";

import appConfig from "@/app.config";
import { useLang } from "@/components/i18n/language-provider";
import { LegalEntityInfo } from "@/components/marketing/legal-entity-info";
import { LegalShell } from "../legal-shell";

type LL = { tr: string; en: string };

const SECTIONS: { title: LL; body: LL[] }[] = [
  {
    title: { tr: "1. Taraflar ve kabul", en: "1. Parties and acceptance" },
    body: [
      {
        tr: `${appConfig.name} ("biz"), telefon aramalarını yanıtlayan, randevu alan ve müşteri adaylarını nitelendiren bir yapay zeka sesli ajan hizmetidir. Hizmet, kliniklere hesap açılarak anahtar teslim sunulur; herkese açık kayıt yoktur. Klinikle aramızdaki ilişki, panelde kabul edilen Hizmet Sözleşmesi ve Veri İşleme Sözleşmesi ile düzenlenir; bu şartlar onların özetidir ve çelişki halinde sözleşmeler geçerlidir. Hizmeti kullanarak bu şartları kabul etmiş sayılırsınız.`,
        en: `${appConfig.name} ("we") is an AI voice agent service that answers calls, books appointments and qualifies leads. The service is delivered turnkey by opening an account for each clinic; there is no public sign-up. Our relationship with a clinic is governed by the Service Agreement and Data Processing Agreement accepted in the panel; these terms summarise them, and the agreements prevail if they conflict. By using the service you accept these terms.`,
      },
    ],
  },
  {
    title: { tr: "2. Hizmetin kapsamı", en: "2. Scope of the service" },
    body: [
      {
        tr: "Hizmet; sesli arama yönetimi, takvim entegrasyonu üzerinden randevu oluşturma/iptal/erteleme ve çağrı sonrası özetleme gibi işlevleri kapsar. Bazı özellikler, kullandığınız üçüncü taraf entegrasyonların (telefon/SIP sağlayıcısı, takvim, e-posta) doğru şekilde bağlanmasına bağlıdır.",
        en: "The service covers call handling, appointment booking/cancellation/rescheduling through a calendar integration, and post-call summarization. Some features depend on correctly connecting third-party integrations (telephony/SIP provider, calendar, email).",
      },
    ],
  },
  {
    title: { tr: "3. Hesap ve kullanım", en: "3. Account and usage" },
    body: [
      {
        tr: "Hesap bilgilerinizin gizliliğinden siz sorumlusunuz. Hizmeti yasa dışı amaçlarla, izinsiz arama (spam) yapmak için veya üçüncü kişilerin haklarını ihlal edecek şekilde kullanamazsınız.",
        en: "You are responsible for keeping your account credentials confidential. You may not use the service for unlawful purposes, unsolicited calling (spam), or in a way that infringes third parties' rights.",
      },
    ],
  },
  {
    title: { tr: "4. Ücretlendirme", en: "4. Billing" },
    body: [
      {
        tr: "Paket ücreti aylıktır ve her takvim ayının başında peşin ödenir. Fiyatlar ABD doları cinsindendir, KDV hariçtir ve fatura tarihindeki T.C. Merkez Bankası döviz satış kuru üzerinden TL olarak faturalanır. Paket dakikasını aşan kullanım, dakika başına aşım ücretiyle bir sonraki faturaya eklenir. Ücretsiz deneme süresi tanınmışsa bu süre içinde paket ücreti alınmaz. Ödenmiş dönem için iade yapılmaz.",
        en: "The package fee is monthly and paid in advance at the start of each calendar month. Prices are in US dollars, exclude VAT (KDV), and are invoiced in Turkish lira at the Central Bank of Türkiye selling rate on the invoice date. Usage above the package minutes is added to the next invoice at the per-minute overage rate. If a free trial was agreed, no package fee is charged during it. Paid periods are non-refundable.",
      },
    ],
  },
  {
    title: { tr: "5. Sorumluluğun sınırlandırılması", en: "5. Limitation of liability" },
    body: [
      {
        tr: `Yapay zeka ajanı, sağladığınız bilgiler ve talimatlar doğrultusunda çalışır; verdiği yanıtların her koşulda hatasız olacağı garanti edilmez. Kritik veya acil durumlarda insan onayı/gözetimi sizin sorumluluğunuzdadır. Hizmet "olduğu gibi" sunulur; dolaylı zararlardan sorumlu tutulamayız.`,
        en: `The AI agent operates based on the information and instructions you provide; we do not guarantee its responses will be error-free in all circumstances. Human review/oversight for critical or urgent situations remains your responsibility. The service is provided "as is"; we are not liable for indirect damages.`,
      },
    ],
  },
  {
    title: { tr: "6. Fesih", en: "6. Termination" },
    body: [
      {
        tr: "Sözleşmeyi, içinde bulunulan ayın bitiminden en az 7 gün önce e-postayla bildirerek ay sonu itibarıyla sona erdirebilirsiniz. Ödeme 7 gün gecikirse veya bu şartlar esaslı şekilde ihlal edilirse, e-postayla bildirdikten sonra hizmeti askıya alabilir veya sona erdirebiliriz. Hesap kapandığında verileriniz 30 gün içinde iade edilir veya silinir.",
        en: "You can end the agreement at the end of a month by emailing us at least 7 days before that month ends. If payment is 7 days late or these terms are materially breached, we may suspend or end the service after notifying you by email. When an account closes, your data is returned or deleted within 30 days.",
      },
    ],
  },
  {
    title: { tr: "7. Değişiklikler ve iletişim", en: "7. Changes and contact" },
    body: [
      {
        tr: `Bu şartları zaman zaman güncelleyebiliriz; önemli değişiklikleri hesabınızla ilişkili e-posta adresine bildiririz. Sorularınız için ${appConfig.domain} üzerinden bize ulaşabilirsiniz.`,
        en: `We may update these terms from time to time; we will notify significant changes to the email address associated with your account. For questions, reach us via ${appConfig.domain}.`,
      },
    ],
  },
];

export default function V2TermsPage() {
  const { lang } = useLang();
  const tt = (v: LL) => v[lang];

  return (
    <LegalShell>
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="font-mono-nums text-[11px] uppercase tracking-wider text-muted-foreground">
          {lang === "tr" ? "Yasal" : "Legal"}
        </p>
        <h1 className="mt-2 font-editorial text-4xl">{lang === "tr" ? "Kullanım Şartları" : "Terms of Service"}</h1>
        <p className="mt-3 text-[13px] text-muted-foreground">
          {lang === "tr" ? "Son güncelleme: 17 Kasım 2026" : "Last updated: November 17, 2026"}
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s, si) => (
            <section key={s.title.en}>
              <h2 className="text-[15px] font-semibold text-foreground">{tt(s.title)}</h2>
              <div className="mt-2 space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="text-[14px] leading-relaxed text-muted-foreground">
                    {tt(p)}
                  </p>
                ))}
                {si === 0 && (
                  <LegalEntityInfo
                    lead={{ tr: "Hizmeti sunan:", en: "Service provided by:" }}
                    className="text-[14px] leading-relaxed text-muted-foreground"
                  />
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </LegalShell>
  );
}
