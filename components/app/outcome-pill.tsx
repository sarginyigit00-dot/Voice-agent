import { OUTCOME_LABEL, OUTCOME_TINT, type Outcome } from "@/lib/demo/data";
import type { Lang } from "@/lib/i18n/config";

const FALLBACK_TINT = "var(--color-muted-foreground)";

/**
 * Coloured, translated pill for a call outcome. Shared by /calls (where the
 * outcome is a typed Outcome) and /crm (where it arrives as a raw string off
 * crm_records, so an unrecognised value has to degrade instead of crashing).
 */
export function OutcomePill({ outcome, lang }: { outcome: Outcome | string; lang: Lang }) {
  const known = outcome in OUTCOME_TINT ? (outcome as Outcome) : null;
  const tint = known ? OUTCOME_TINT[known] : FALLBACK_TINT;
  const label = known ? OUTCOME_LABEL[known][lang] : outcome;

  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold"
      style={{ color: tint, background: `color-mix(in oklch, ${tint} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tint }} />
      {label}
    </span>
  );
}
