"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/notify/report-client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError("error.tsx", error, error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Bir şeyler ters gitti</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Sorunu bize otomatik olarak ilettik. Tekrar deneyebilirsiniz. / Something went wrong; we have been notified.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Tekrar dene / Try again
      </button>
    </div>
  );
}
