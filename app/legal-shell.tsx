"use client";

import Link from "next/link";
import appConfig from "@/app.config";
import { LogoMark } from "@/components/ui/logo";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useLang } from "@/components/i18n/language-provider";
import { ForceLightRoute } from "./force-light";

/**
 * Shared chrome for the legal pages (/gizlilik, /sartlar) — same `.ed-light`
 * palette and header/footer language as the landing page, so clicking a
 * footer link never drops the visitor into the dark cockpit theme.
 */
export function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ed-light flex min-h-dvh flex-col">
      <ForceLightRoute />
      <LegalNav />
      <div className="flex-1">{children}</div>
      <LegalFooter />
    </div>
  );
}

function LegalNav() {
  const { lang } = useLang();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="h-6 w-6" />
          <span className="text-[18px] font-semibold tracking-tight">{appConfig.name}</span>
        </Link>
        <div className="ml-auto flex items-center gap-2.5">
          <LanguageToggle />
          <Link
            href="/login"
            className="hidden h-11 items-center rounded-full px-4 text-[14.5px] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            {lang === "tr" ? "Giriş yap" : "Sign in"}
          </Link>
          <Link href="/signup" className="ed-pill ed-pill-primary h-11 px-5 text-[14.5px]">
            {lang === "tr" ? "Kliniğinizde deneyin" : "Try it in your clinic"}
          </Link>
        </div>
      </div>
    </header>
  );
}

function LegalFooter() {
  const { lang } = useLang();
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-10">
      <div className="flex items-center gap-2.5">
        <LogoMark className="h-5 w-5 opacity-70" />
        <span className="font-mono-nums text-[13px] text-muted-foreground">
          © {new Date().getFullYear()} {appConfig.domain}
        </span>
      </div>
      <div className="flex items-center gap-6">
        {[
          { label: { tr: "Şartlar", en: "Terms" }, href: "/sartlar" },
          { label: { tr: "Gizlilik", en: "Privacy" }, href: "/gizlilik" },
          { label: { tr: "KVKK", en: "Data" }, href: "/gizlilik#kvkk" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="text-[14px] text-muted-foreground transition-colors hover:text-foreground">
            {l.label[lang]}
          </Link>
        ))}
      </div>
    </footer>
  );
}
