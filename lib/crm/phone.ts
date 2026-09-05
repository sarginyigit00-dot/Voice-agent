import type { CrmRecord } from "@/lib/crm/types";

/**
 * Digits-only form of a phone number, so the same caller groups together no
 * matter how the number was formatted: "+90 532 555 0241" and
 * "+905325550241" both become "905325550241".
 *
 * Known limit: a number written in local form ("0532 555 0241") will NOT match
 * the E.164 form of the same line. Stripping or adding a country code to fix
 * that would wrongly merge distinct international numbers, and Vapi/Twilio
 * always hand us E.164 — so this stays a straight digit strip.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Stable identity for grouping calls into one contact. Falls back to the
 * caller's name when there's no number — never an empty string, which would
 * pile every unnamed caller into a single bogus contact.
 */
export function contactKey(r: Pick<CrmRecord, "caller_number" | "caller_name">): string {
  const phone = normalizePhone(r.caller_number);
  if (phone) return phone;
  return `name:${r.caller_name.trim().toLowerCase() || "unknown"}`;
}
