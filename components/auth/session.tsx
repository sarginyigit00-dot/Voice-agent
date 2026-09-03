"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";

/** The `profiles` row that `handle_new_user()` creates for every auth user. */
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "normal";
  is_active: boolean;
}

interface SessionState {
  /** null = signed out, undefined = still resolving. */
  session: Session | null | undefined;
  profile: Profile | null;
  /** True when the visitor entered the sample-data cockpit instead of signing in. */
  demo: boolean;
  /** The only supported way to enter demo mode — keeps localStorage and state in lockstep. */
  enterDemo: () => void;
  /** The mirror of enterDemo — call it whenever real credentials take over. */
  exitDemo: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState>({
  session: null,
  profile: null,
  demo: false,
  enterDemo: () => {},
  exitDemo: () => {},
  signOut: async () => {},
});

/** Set by the auth screen's demo bypass so the cockpit stays reachable without an account. */
export const DEMO_KEY = "randevox:demo";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demo, setDemo] = useState(() => typeof window !== "undefined" && localStorage.getItem(DEMO_KEY) === "1");

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      // Demo mode: nothing to resolve, never block the UI.
      setSession(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !session) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, email, full_name, role, is_active")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile((data as Profile) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  function enterDemo() {
    localStorage.setItem(DEMO_KEY, "1");
    setDemo(true);
  }

  function exitDemo() {
    localStorage.removeItem(DEMO_KEY);
    setDemo(false);
  }

  async function signOut() {
    exitDemo();
    await getSupabaseBrowser()?.auth.signOut();
    router.push("/login");
  }

  return (
    <Ctx.Provider value={{ session, profile, demo, enterDemo, exitDemo, signOut }}>{children}</Ctx.Provider>
  );
}

export function useSession() {
  return useContext(Ctx);
}

/**
 * Keeps the cockpit behind a session once Supabase is wired. The demo bypass
 * still gets through — this kit is meant to be clickable without an account.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, demo } = useSession();
  const router = useRouter();

  const locked = isSupabaseConfigured && session === null && !demo;

  useEffect(() => {
    if (locked) router.replace("/login");
  }, [locked, router]);

  if (isSupabaseConfigured && session === undefined) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">…</div>;
  }
  if (locked) return null;
  return <>{children}</>;
}
