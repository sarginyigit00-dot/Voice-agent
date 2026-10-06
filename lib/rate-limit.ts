/**
 * Best-effort fixed-window limiter for anonymous endpoints. State lives in the
 * serverless instance's memory, so it slows a single client down but is not a
 * hard global cap — pair it with a database-backed cap where abuse is costly
 * (see MAX_LEADS_PER_CLINIC_PER_DAY in lib/leads/callback.ts).
 */
const buckets = new Map<string, { count: number; since: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.since > windowMs) buckets.delete(k);
  const entry = buckets.get(key);
  if (!entry || now - entry.since > windowMs) {
    buckets.set(key, { count: 1, since: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

/** Client address as Vercel reports it; the last x-forwarded-for hop is the one the platform appended. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",").pop()!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
