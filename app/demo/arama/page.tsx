"use client";

/**
 * /demo/arama — the Live Demo call simulator, pulled out of the main landing
 * page so the public site no longer surfaces it. Reachable only by direct
 * link; nothing in the app nav points here.
 */

import Link from "next/link";
import appConfig from "@/app.config";
import { LogoMark } from "@/components/ui/logo";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useLang } from "@/components/i18n/language-provider";
import { LiveDemo } from "@/components/marketing/live-demo";
import { ForceLightRoute } from "../../force-light";

export default function DemoCallPage() {
  const { lang } = useLang();

  return (
    <div className="ed-light flex min-h-dvh flex-col">
      <ForceLightRoute />
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-6 w-6" />
            <span className="text-[18px] font-semibold tracking-tight">{appConfig.name}</span>
          </Link>
          <div className="ml-auto flex items-center gap-2.5">
            <LanguageToggle />
            <Link href="/signup" className="ed-pill ed-pill-primary h-11 px-5 text-[14.5px]">
              {lang === "tr" ? "Kliniğinizde deneyin" : "Try it in your clinic"}
            </Link>
          </div>
        </div>
      </header>
      <LiveDemo />
    </div>
  );
}
