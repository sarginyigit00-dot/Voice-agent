"use client";

import { useLang } from "@/components/i18n/language-provider";
import { LegalShell } from "@/app/legal-shell";

export type LL = { tr: string; en: string };

/** One block inside a section: a paragraph, or a bulleted list. */
export type DocBlock = LL | { list: LL[] };

export interface DocSection {
  /** Optional anchor id, so other pages can deep-link (e.g. /guvenlik#saklama). */
  id?: string;
  title: LL;
  body: DocBlock[];
}

/**
 * Shared body for the footer's text pages (/iade, /acik-riza, /ticari-ileti,
 * /guvenlik, /hakkimizda, /iletisim) — same typography as /gizlilik and
 * /sartlar, inside LegalShell.
 */
export function LegalDoc({
  eyebrow,
  title,
  updated,
  intro,
  sections,
  children,
}: {
  eyebrow?: LL;
  title: LL;
  /** "Son güncelleme" line; omit for non-legal pages. */
  updated?: LL;
  intro?: LL;
  sections: DocSection[];
  /** Extra content rendered after the sections (CTAs, contact cards…). */
  children?: React.ReactNode;
}) {
  const { lang } = useLang();
  const tt = (v: LL) => v[lang];

  return (
    <LegalShell>
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="font-mono-nums text-[11px] uppercase tracking-wider text-muted-foreground">
          {tt(eyebrow ?? { tr: "Yasal", en: "Legal" })}
        </p>
        <h1 className="mt-2 font-editorial text-4xl">{tt(title)}</h1>
        {updated && <p className="mt-3 text-[13px] text-muted-foreground">{tt(updated)}</p>}
        {intro && <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">{tt(intro)}</p>}

        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.title.en} id={s.id} className="scroll-mt-20">
              <h2 className="text-[15px] font-semibold text-foreground">{tt(s.title)}</h2>
              <div className="mt-2 space-y-3">
                {s.body.map((b, i) =>
                  "list" in b ? (
                    <ul key={i} className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-muted-foreground">
                      {b.list.map((item, j) => (
                        <li key={j}>{tt(item)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i} className="text-[14px] leading-relaxed text-muted-foreground">
                      {tt(b)}
                    </p>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>

        {children}
      </div>
    </LegalShell>
  );
}
