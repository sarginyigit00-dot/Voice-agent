"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/auth/session";
import { authedFetch } from "@/lib/supabase/authed-fetch";
import { featureForPath } from "@/lib/usage/features";

/**
 * Tells app/api/usage which cockpit page was opened — one ping per feature
 * per page load, nothing at all in demo mode. Renders nothing. Mounted in
 * app/(app)/layout.tsx only.
 */
export function UsagePing() {
  const { demo } = useSession();
  const pathname = usePathname();
  const sent = useRef(new Set<string>());

  useEffect(() => {
    if (demo || !pathname) return;
    const feature = featureForPath(pathname);
    if (!feature || sent.current.has(feature)) return;
    sent.current.add(feature);
    authedFetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [demo, pathname]);

  return null;
}
