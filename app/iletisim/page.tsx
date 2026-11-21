"use client";

import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";
import { Icon } from "@/components/ui/icon";
import { LegalEntityInfo } from "@/components/marketing/legal-entity-info";
import { CONTACT_EMAIL } from "@/components/marketing/site-footer";
import { LegalDoc, type DocSection } from "@/components/marketing/legal-doc";

const SECTIONS: DocSection[] = [
  {
    title: { tr: "Sık sorulanlar", en: "Common questions" },
    body: [
      {
        list: [
          { tr: "Kurulum ne kadar sürer? Gerekli bilgiler ve hat bağlantısı tamamlandıktan sonra genellikle 1 hafta içinde.", en: "How long does setup take? Usually within a week once the required details and the line connection are done." },
          { tr: "Mevcut numaram değişir mi? Hayır. Hattınızı yönlendirirsiniz, hastalarınız aynı numarayı aramaya devam eder.", en: "Does my number change? No. You forward your line and patients keep calling the same number." },
          { tr: "Panelime giremiyorum. Hesabınızdaki e-posta adresinden bize yazın; giriş bilgilerinizi yenileriz.", en: "I can't sign in. Write to us from your account's email address and we'll reset your login." },
        ],
      },
    ],
  },
];

function Card({ icon, title, body, href, cta }: { icon: string; title: string; body: string; href: string; cta: string }) {
  const external = href.startsWith("mailto:");
  const cls = "mt-auto inline-flex w-fit items-center gap-1.5 text-[14px] font-medium text-violet hover:underline";
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-5">
      <Icon name={icon} className="h-5 w-5 text-violet" />
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="text-[14px] leading-relaxed text-muted-foreground">{body}</p>
      {external ? <a href={href} className={cls}>{cta}</a> : <Link href={href} className={cls}>{cta}</Link>}
    </div>
  );
}

export default function ContactPage() {
  const { lang } = useLang();
  const tr = lang === "tr";
  return (
    <LegalDoc
      eyebrow={{ tr: "Şirket", en: "Company" }}
      title={{ tr: "İletişim", en: "Contact" }}
      intro={{
        tr: "Kliniğiniz için Randevox'u konuşmak, panelle ilgili yardım almak ya da bir soru sormak için bize ulaşın.",
        en: "Reach us to talk about Randevox for your clinic, get help with the panel, or ask a question.",
      }}
      sections={[]}
    >
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Card
          icon="phone-call"
          title={tr ? "Satış ve demo" : "Sales & demo"}
          body={tr ? "Formu doldurun, ekibimiz sizi telefonla arasın." : "Fill in the form and our team will call you."}
          href="/demo-talep"
          cta={tr ? "Demo talep et →" : "Request a demo →"}
        />
        <Card
          icon="mail"
          title={tr ? "Destek ve genel sorular" : "Support & questions"}
          body={tr ? "Panel, fatura, KVKK başvurusu ve diğer her konu için." : "Panel, invoices, KVKK requests and anything else."}
          href={`mailto:${CONTACT_EMAIL}`}
          cta={CONTACT_EMAIL}
        />
        <Card
          icon="log-in"
          title={tr ? "Klinik girişi" : "Clinic sign-in"}
          body={tr ? "Hesabı olan klinikler panele buradan girer." : "Clinics with an account sign in to the panel here."}
          href="/login"
          cta={tr ? "Giriş yap →" : "Sign in →"}
        />
      </div>

      <div className="mt-12">
        {SECTIONS.map((s) => (
          <section key={s.title.en}>
            <h2 className="text-[15px] font-semibold text-foreground">{s.title[lang]}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-muted-foreground">
              {s.body.flatMap((b) => ("list" in b ? b.list : [b])).map((item, i) => (
                <li key={i}>{item[lang]}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <LegalEntityInfo className="mt-10 text-[13px] leading-relaxed text-muted-foreground" />
    </LegalDoc>
  );
}
