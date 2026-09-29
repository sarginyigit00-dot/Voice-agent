"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/notify/report-client";

/** Last resort: the root layout itself crashed, so no providers or theme exist here — plain inline styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError("global-error.tsx", error, error.digest);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          background: "#0b0b12",
          color: "#f2f2f7",
          textAlign: "center",
          padding: 16,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Bir şeyler ters gitti</h1>
        <p style={{ maxWidth: 420, fontSize: 14, opacity: 0.7, margin: 0 }}>
          Sorunu bize otomatik olarak ilettik. / Something went wrong; we have been notified.
        </p>
        <button
          onClick={reset}
          style={{ padding: "8px 16px", borderRadius: 6, border: 0, background: "#7c5cff", color: "#fff", fontSize: 14 }}
        >
          Tekrar dene / Try again
        </button>
      </body>
    </html>
  );
}
