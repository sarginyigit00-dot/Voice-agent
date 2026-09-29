/**
 * Browser side of the error alerts: posts to /api/report-error. Never throws;
 * uses sendBeacon-style keepalive so it survives a page that is going away.
 */
export function reportClientError(source: string, err: unknown, digest?: string): void {
  try {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    void fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, message, digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting must never cause another error */
  }
}
