"use client";

import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";

/** Footer status bar: a live indicator and the legal links. */
export function StatusBar() {
  const { lang } = useLang();

  return (
    <footer className="z-20 flex h-9 shrink-0 items-center gap-3 border-t border-border bg-background/90 px-3 font-mono text-[11px] text-muted-foreground backdrop-blur sm:px-4">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full pulse-dot" style={{ background: "var(--color-booked)" }} />
        <span style={{ color: "var(--color-booked)" }}>{lang === "tr" ? "Çalışıyor" : "Live"}</span>
      </span>
      <div className="ml-auto flex items-center gap-3">
        <Link href="/sartlar" className="hidden transition-colors hover:text-foreground sm:inline">{lang === "tr" ? "Şartlar" : "Terms"}</Link>
        <Link href="/gizlilik" className="hidden transition-colors hover:text-foreground sm:inline">{lang === "tr" ? "Gizlilik" : "Privacy"}</Link>
      </div>
    </footer>
  );
}
