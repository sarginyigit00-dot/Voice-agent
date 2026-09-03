"use client";

import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/** Footer status bar: a live indicator, the recording toggle and the legal links. */
export function StatusBar() {
  const { lang } = useLang();
  // Shares one saved preference with Settings → "Aramaları kaydet", so the two
  // switches can never disagree.
  const { prefs, update } = usePrefs();
  const recording = prefs.recording;

  return (
    <footer className="z-20 flex h-9 shrink-0 items-center gap-3 border-t border-border bg-background/90 px-3 font-mono text-[11px] text-muted-foreground backdrop-blur sm:px-4">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full pulse-dot" style={{ background: "var(--color-booked)" }} />
        <span style={{ color: "var(--color-booked)" }}>{lang === "tr" ? "Çalışıyor" : "Live"}</span>
      </span>
      <div className="ml-auto flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          {lang === "tr" ? "Kayıt" : "Recording"}
          <button
            onClick={() => update({ recording: !recording })}
            aria-label={lang === "tr" ? "Aramaları kaydet" : "Record calls"}
            role="switch"
            aria-checked={recording}
            className={cn("relative h-4 w-7 rounded-full transition-colors", recording ? "bg-violet/40" : "bg-muted")}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full bg-foreground transition-all",
                recording ? "left-[14px] bg-violet" : "left-0.5",
              )}
            />
          </button>
        </span>
        <Link href="/sartlar" className="hidden transition-colors hover:text-foreground sm:inline">{lang === "tr" ? "Şartlar" : "Terms"}</Link>
        <Link href="/gizlilik" className="hidden transition-colors hover:text-foreground sm:inline">{lang === "tr" ? "Gizlilik" : "Privacy"}</Link>
      </div>
    </footer>
  );
}
