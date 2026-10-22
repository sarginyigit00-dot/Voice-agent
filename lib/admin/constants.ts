/**
 * Admin constants shared by the server actions and the client panel.
 *
 * Deliberately its own module with no imports: `lib/admin/actions.ts` pulls in
 * the service-role Supabase client, so a client component can only take *types*
 * from it. Values both sides need live here instead.
 */

/**
 * Floor for an operator-set password, enforced on both sides (the panel checks
 * it before POSTing, `runAdminAction` checks it again because the route is
 * reachable on its own). Higher than the 6 the signup form asks for: this one
 * is typed by someone other than its owner and travels to them out-of-band, so
 * it starts stronger.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * The packages sold (app.config.ts pricing): id → label, monthly price and
 * included minutes. Choosing a plan when a clinic is created sets its quota to
 * this; the quota stays editable per clinic for custom deals.
 *
 * Sized for dental clinics by number of dentists — the one question a buyer
 * can answer without thinking. Minutes assume ~1.5 min per booked call (real
 * Vapi average). Cost is ~$0.07/min on Vapi's own voices, ~$0.13 with
 * ElevenLabs — quotas are kept tight so either voice leaves a margin;
 * recalibrate once real clinics' usage is in. Multi-branch groups get a custom
 * quote: pick the nearest plan and edit the quota.
 * An id no longer listed here reads as `klinik` (lib/admin/clinics.ts).
 */
export const PLANS = {
  klinik: { label: "Klinik", priceUsd: 499, minutes: 300 },
  poliklinik: { label: "Poliklinik", priceUsd: 899, minutes: 1000 },
} as const;

/** Billed per minute past a clinic's monthly quota. */
export const OVERAGE_USD_PER_MIN = 0.6;

export type PlanId = keyof typeof PLANS;

export function isPlan(v: unknown): v is PlanId {
  return typeof v === "string" && Object.hasOwn(PLANS, v);
}

/**
 * A clinic's Ruul subscription as the operator last recorded it. Set by hand:
 * the checkout link goes to the clinic out-of-band and Ruul sends no webhook.
 */
export const BILLING_STATUSES = {
  pending: "Ödeme bekliyor",
  active: "Aktif",
  past_due: "Gecikmiş",
  cancelled: "İptal",
} as const;

export type BillingStatus = keyof typeof BILLING_STATUSES;

export function isBillingStatus(v: unknown): v is BillingStatus {
  return typeof v === "string" && Object.hasOwn(BILLING_STATUSES, v);
}
