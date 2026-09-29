"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/notify/report-client";

/** Catches errors React's boundaries don't see (event handlers, promises) and reports them. */
export function ErrorListener() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError("window.onerror", e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportClientError("unhandledrejection", e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
