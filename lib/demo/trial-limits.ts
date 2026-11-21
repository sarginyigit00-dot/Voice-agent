/** Clinic web-trial allowances — client-safe, shared by /admin and the server (lib/demo/trials.ts). */
export const TRIAL_DAYS = 14;
export const TRIAL_MAX_CALLS = 15;
/** So the whole allowance can't go in one sitting. */
export const TRIAL_CALLS_PER_DAY = 5;
/** Shorter calls (didn't connect, mic trouble, a mis-click) don't use up a call. */
export const TRIAL_COUNTED_MIN_SECONDS = 15;
/**
 * Starts (tokens handed out) are capped too, or uncounted short calls could
 * be repeated without end: three per counted call is plenty of retries.
 */
export const TRIAL_MAX_STARTS = TRIAL_MAX_CALLS * 3;

/** Self-serve (/demo-talep): new trials a day in total, and from one IP. */
export const SELF_SERVE_TRIALS_PER_DAY = 5;
export const SELF_SERVE_TRIALS_PER_IP_PER_DAY = 1;
