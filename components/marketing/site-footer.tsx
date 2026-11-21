"use client";

import Link from "next/link";
import appConfig from "@/app.config";
import { LogoMark } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { useLang } from "@/components/i18n/language-provider";
import { LegalEntityInfo } from "@/components/marketing/legal-entity-info";
import { WEB_TRIAL_LIVE } from "@/lib/marketing-flags";

type L = { tr: string; en: string };
type FooterLink = { label: L; href: string };

/** Public contact address — the same one the Privacy Policy names for KVKK requests. */
export const CONTACT_EMAIL = "info@randevoxai.com";

/**
 * Marketing-site footer, shared by the landing page and every page in
 * LegalShell. Column layout follows the usual SaaS pattern (Ürün / Şirket /
 * Destek / Yasal). Trial-only links wait for WEB_TRIAL_LIVE. It deliberately never links /demo or /admin — those
 * surfaces stay reachable only by typing the URL.
 */
const COLUMNS: { title: L; links: FooterLink[] }[] = [
  {
    title: { tr: "Ürün", en: "Product" },
    links: [
      { label: { tr: "Neler yapar", en: "What it does" }, href: "/#features" },
      ...(WEB_TRIAL_LIVE ? [{ label: { tr: "Ajanla konuşun", en: "Talk to the agent" }, href: "/#dene" }] : []),
      { label: { tr: "Kayıp arama hesaplayıcı", en: "Missed-call calculator" }, href: "/#hesap" },
      { label: { tr: "Nasıl kurulur", en: "How setup works" }, href: "/#how" },
      { label: { tr: "Fiyatlar", en: "Pricing" }, href: "/#fiyatlar" },
      { label: { tr: "Sık sorulan sorular", en: "FAQ" }, href: "/#faq" },
    ],
  },
  {
    title: { tr: "Şirket", en: "Company" },
    links: [
      { label: { tr: "Hakkımızda", en: "About" }, href: "/hakkimizda" },
      { label: { tr: "İletişim", en: "Contact" }, href: "/iletisim" },
      { label: { tr: "Güvenlik ve KVKK", en: "Security & KVKK" }, href: "/guvenlik" },
    ],
  },
  {
    title: { tr: "Destek", en: "Support" },
    links: [
      { label: { tr: "Yardım merkezi", en: "Help center" }, href: `mailto:${CONTACT_EMAIL}` },
      { label: { tr: "Kliniğinizde deneyin", en: "Try it in your clinic" }, href: "/demo-talep" },
      { label: { tr: "Klinik girişi", en: "Clinic sign-in" }, href: "/login" },
    ],
  },
  {
    title: { tr: "Yasal", en: "Legal" },
    links: [
      { label: { tr: "Gizlilik Politikası", en: "Privacy Policy" }, href: "/gizlilik" },
      { label: { tr: "Kullanım Şartları", en: "Terms of Service" }, href: "/sartlar" },
      { label: { tr: "Teslimat ve İade Şartları", en: "Delivery & Refund Terms" }, href: "/iade" },
      ...(WEB_TRIAL_LIVE ? [{ label: { tr: "Açık Rıza Metni", en: "Explicit Consent Notice" }, href: "/acik-riza" }] : []),
      { label: { tr: "Ticari Elektronik İleti Onayı", en: "Commercial Message Consent" }, href: "/ticari-ileti" },
    ],
  },
];

export function SiteFooter() {
  const { lang } = useLang();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-5 py-16 md:grid-cols-[1.5fr_repeat(4,1fr)] md:gap-x-8">
        {/* Brand */}
        <div className="col-span-2 flex flex-col gap-5 md:col-span-1 md:pr-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-6 w-6" />
            <span className="text-[18px] font-semibold tracking-tight">{appConfig.name}</span>
          </Link>
          <p className="max-w-xs text-[14px] leading-relaxed text-muted-foreground">
            {lang === "tr"
              ? "Randevox; diş kliniklerine gelen telefonları 7/24 yapay zekâ asistanıyla karşılayan, randevuyu takvime yazan ve her görüşmeyi tek panelde toplayan hizmettir."
              : "Randevox answers dental clinics' phone calls 24/7 with an AI assistant, books appointments into the calendar and keeps every call in one panel."}
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex w-fit items-center gap-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="mail" className="h-4 w-4" />
            {CONTACT_EMAIL}
          </a>
          <LegalEntityInfo separator=" · " className="text-[12.5px] leading-relaxed text-muted-foreground" />
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title.en} aria-label={col.title[lang]} className="flex flex-col gap-3">
            <p className="text-[14px] font-semibold text-foreground">{col.title[lang]}</p>
            <ul className="flex flex-col gap-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[14px] leading-snug text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label[lang]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6">
          <span className="font-mono-nums text-[12.5px] text-muted-foreground">
            © {new Date().getFullYear()} {appConfig.name}. {lang === "tr" ? "Tüm hakları saklıdır." : "All rights reserved."}
          </span>
          <span className="font-mono-nums text-[12.5px] text-muted-foreground">{appConfig.domain}</span>
        </div>
      </div>
    </footer>
  );
}
