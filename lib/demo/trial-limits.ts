/** Clinic web-trial allowances — client-safe, shared by /admin and the server (lib/demo/trials.ts). */
export const TRIAL_DAYS = 14;
export const TRIAL_MAX_CALLS = 15;
/** So the whole allowance can't go in one sitting. */
export const TRIAL_CALLS_PER_DAY = 5;
/**
 * Every started call uses one of the trial's calls (counted from
 * demo_call_starts, so the meter drops the moment a call starts). Calls this
 * long or longer are also logged in demo_trial_calls, for the operator.
 */
export const TRIAL_COUNTED_MIN_SECONDS = 15;

/** Self-serve (/demo-talep): new trials a day in total, and from one IP. */
export const SELF_SERVE_TRIALS_PER_DAY = 5;
export const SELF_SERVE_TRIALS_PER_IP_PER_DAY = 1;
