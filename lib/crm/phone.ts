import type { CrmRecord } from "@/lib/crm/types";

/**
 * Digits-only form of a phone number, so the same caller groups together no
 * matter how the number was formatted: "+1 (415) 555-0182" and
 * "+14155550182" both become "14155550182".
 *
 * Known limit: a 10-digit local number ("(415) 555-0182") will NOT match the
 * 11-digit E.164 form of the same line. Stripping a leading "1" to fix that
 * would wrongly merge distinct international numbers, and Vapi/Twilio always
 * hand us E.164 — so this stays a straight digit strip.
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
