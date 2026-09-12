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
 * The packages sold (app.config.ts pricing): id → label and included minutes
 * per month. Choosing a plan when a clinic is created sets its quota to
 * this; the quota stays editable per clinic for custom deals.
 */
export const PLANS = {
  klinik: { label: "Klinik", minutes: 1000 },
  klinik_pro: { label: "Klinik Pro", minutes: 2500 },
} as const;

export type PlanId = keyof typeof PLANS;

export function isPlan(v: unknown): v is PlanId {
  return typeof v === "string" && Object.hasOwn(PLANS, v);
}
