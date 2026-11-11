"use client";

import { useLang } from "@/components/i18n/language-provider";
import { legalEntityLines } from "@/lib/legal-entity";

/**
 * The operator's filled-in company details (lib/legal-entity.ts), one
 * "Label: value" per item. Renders nothing while every field is empty, so no
 * placeholder ever reaches the site.
 */
export function LegalEntityInfo({
  className,
  separator = " · ",
  lead,
}: {
  className?: string;
  separator?: string;
  /** Text shown before the details — only when there are details. */
  lead?: { tr: string; en: string };
}) {
  const { lang } = useLang();
  const lines = legalEntityLines(lang);
  if (lines.length === 0) return null;
  return (
    <p className={className}>
      {lead && `${lead[lang]} `}
      {lines.map((l, i) => (
        <span key={l.key}>
          {i > 0 && separator}
          {l.key === "title" ? l.value : `${l.label}: ${l.value}`}
        </span>
      ))}
    </p>
  );
}
