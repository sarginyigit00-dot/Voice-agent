"use client";

import appConfig from "@/app.config";
import { useLang } from "@/components/i18n/language-provider";
import { LegalShell } from "../legal-shell";

type LL = { tr: string; en: string };

const SECTIONS: { title: LL; body: LL[] }[] = [
  {
    title: { tr: "1. Taraflar ve kabul", en: "1. Parties and acceptance" },
    body: [
      {
        tr: `${appConfig.name} ("biz"), telefon aramalarını yanıtlayan, randevu alan ve müşteri adaylarını nitelendiren bir yapay zeka sesli ajan hizmetidir. Hizmete kaydolarak veya kullanarak bu şartları kabul etmiş sayılırsınız.`,
        en: `${appConfig.name} ("we") is an AI voice agent service that answers calls, books appointments and qualifies leads. By signing up for or using the service you accept these terms.`,
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
        tr: "Ücretli plan seçtiğinizde, seçtiğiniz döneme göre (aylık/yıllık) faturalandırılırsınız. İptal, bir sonraki fatura döneminden itibaren geçerli olur; geçmiş dönemler için iade yapılmaz, aksi ayrıca belirtilmedikçe.",
        en: "If you choose a paid plan, you are billed according to your selected period (monthly/annual). Cancellation takes effect from the next billing cycle; past periods are non-refundable unless stated otherwise.",
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
        tr: "Hesabınızı istediğiniz zaman kapatabilirsiniz. Bu şartları ihlal etmeniz durumunda hizmete erişiminizi askıya alabilir veya sonlandırabiliriz.",
        en: "You may close your account at any time. We may suspend or terminate your access if you breach these terms.",
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
          {lang === "tr" ? "Son güncelleme: 30 Ağustos 2026" : "Last updated: August 30, 2026"}
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title.en}>
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
