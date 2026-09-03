import type { CrmRecord } from "@/lib/crm/types";
import { contactKey } from "@/lib/crm/phone";
import type { L } from "@/lib/i18n/config";

/** Every call a single person made, collapsed into one row for /crm. */
export interface CrmContact {
  key: string;
  /** Display name — the most recent call's caller_name, or the number when it's unknown. */
  name: string;
  /** Raw (formatted) number as it last arrived, not the normalized key. */
  number: string;
  /** All of this person's calls, newest first. */
  calls: CrmRecord[];
  callCount: number;
  lastContactAt: string;
  /** Derived from the latest call's outcome — see CONTACT_STATUS. */
  status: ContactStatus;
  /** The latest call's first extracted action item, when the pipeline produced one. */
  nextStep: string;
}

export type ContactStatus = "booked" | "resolved" | "transferred" | "followup" | "unknown";

export const CONTACT_STATUS: Record<ContactStatus, L> = {
  booked: { tr: "Randevulu", en: "Booked" },
  resolved: { tr: "Çözüldü", en: "Resolved" },
  transferred: { tr: "Transfer edildi", en: "Transferred" },
  followup: { tr: "Takip gerekiyor", en: "Needs follow-up" },
  unknown: { tr: "Belirsiz", en: "Unknown" },
};

function statusFromOutcome(outcome: string): ContactStatus {
  switch (outcome) {
    case "booked":
      return "booked";
    case "resolved":
      return "resolved";
    case "transferred":
      return "transferred";
    case "voicemail":
    case "missed":
      return "followup";
    default:
      return "unknown";
  }
}

/**
 * Collapses a flat crm_records list into one entry per person, keyed by
 * normalized phone number. Runs the same way on real Supabase rows and on the
 * demo set, so /crm has a single code path.
 */
export function groupCallsIntoContacts(records: CrmRecord[]): CrmContact[] {
  const byKey = new Map<string, CrmRecord[]>();

  for (const r of records) {
    const key = contactKey(r);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(r);
    else byKey.set(key, [r]);
  }

  const contacts: CrmContact[] = [];

  for (const [key, calls] of byKey) {
    calls.sort((a, b) => +new Date(b.started_at) - +new Date(a.started_at));
    const latest = calls[0];
    const named = latest.caller_name && latest.caller_name !== "Unknown";

    contacts.push({
      key,
      name: named ? latest.caller_name : latest.caller_number || latest.caller_name,
      number: latest.caller_number,
      calls,
      callCount: calls.length,
      lastContactAt: latest.started_at,
      status: statusFromOutcome(latest.outcome),
      nextStep: latest.actions?.[0] ?? "",
    });
  }

  return contacts.sort((a, b) => +new Date(b.lastContactAt) - +new Date(a.lastContactAt));
}
