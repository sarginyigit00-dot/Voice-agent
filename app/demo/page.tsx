"use client";

/**
 * /demo — the one door into the sample-data cockpit. It flips the demo flag
 * and hands off to /dashboard, which (like every other cockpit page) reads
 * lib/demo/data.ts whenever that flag is on, regardless of whether Supabase
 * is configured or somebody is signed in for real. Signing in on /login
 * turns it back off — see components/auth/auth-screen.tsx.
 *
 * Nothing in the app links here; it exists to be typed in directly.
 * The marketing call simulator lives at /demo/arama.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/auth/session";

export default function DemoEntryPage() {
  const router = useRouter();
  const { enterDemo } = useSession();

  useEffect(() => {
    enterDemo();
    router.replace("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">…</div>;
}
