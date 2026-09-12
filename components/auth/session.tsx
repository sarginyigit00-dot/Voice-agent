"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { useLang } from "@/components/i18n/language-provider";

/** The `profiles` row that `handle_new_user()` creates for every auth user. */
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "normal";
  is_active: boolean;
}

/** The clinic a staff account works in (supabase/schema.sql → clinic_members). */
export interface ClinicSummary {
  id: string;
  name: string;
}

interface SessionState {
  /** null = signed out, undefined = still resolving. */
  session: Session | null | undefined;
  profile: Profile | null;
  /**
   * The clinic this account works in. Null when signed out, in demo mode,
   * while resolving, or when the account isn't attached to a clinic —
   * `membership` tells those apart.
   */
  clinic: ClinicSummary | null;
  /**
   * "loading" until the membership lookup lands; "none" only when it
   * succeeded and found no clinic. A FAILED lookup reads as "member": this
   * gate is a courtesy screen — RLS is what actually keeps clinics apart —
   * and a network blip must not lock a real clinic out of its own panel.
   */
  membership: "loading" | "member" | "none";
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
  clinic: null,
  membership: "member",
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
  // Keyed by user id, so signing in as someone else reads as "loading" again
  // instead of briefly showing the previous account's clinic.
  const [membershipFor, setMembershipFor] = useState<{
    userId: string;
    clinic: ClinicSummary | null;
    failed: boolean;
  } | null>(null);
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

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !session) return;
    const userId = session.user.id;
    let cancelled = false;
    supabase
      .from("clinic_members")
      .select("clinics(id, name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("[session] clinic lookup failed:", error.message);
        const rel = (data as { clinics: ClinicSummary | ClinicSummary[] | null } | null)?.clinics;
        const clinic = (Array.isArray(rel) ? rel[0] : rel) ?? null;
        setMembershipFor({ userId, clinic, failed: Boolean(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const resolved = session && membershipFor?.userId === session.user.id ? membershipFor : null;
  const clinic = resolved?.clinic ?? null;
  const membership: SessionState["membership"] = !session
    ? "member"
    : !resolved
      ? "loading"
      : resolved.clinic || resolved.failed
        ? "member"
        : "none";

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
    <Ctx.Provider value={{ session, profile, clinic, membership, demo, enterDemo, exitDemo, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  return useContext(Ctx);
}

/**
 * True when this cockpit is allowed to render `lib/demo/data.ts` sample rows:
 * either the visitor came through the /demo bypass, or the workspace has no
 * Supabase keys at all so there is nothing real to show.
 *
 * A real signed-in account must NEVER see sample data — not even for the few
 * hundred milliseconds a fetch takes, which is what this exists to prevent.
 * Read it at first render and seed state from it instead of defaulting to the
 * demo arrays.
 */
export function useSampleData(): boolean {
  const { demo } = useSession();
  return !isSupabaseConfigured || demo;
}

/**
 * Keeps the cockpit behind a session once Supabase is wired. The demo bypass
 * still gets through — this kit is meant to be clickable without an account.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, demo, membership, signOut } = useSession();
  const { lang } = useLang();
  const router = useRouter();

  const locked = isSupabaseConfigured && session === null && !demo;
  // A real account the operator hasn't attached to a clinic — e.g. a Google
  // sign-in by someone who isn't a customer. RLS would show them an empty
  // panel anyway; this tells them why instead.
  const detached = isSupabaseConfigured && Boolean(session) && !demo && membership !== "member";

  useEffect(() => {
    if (locked) router.replace("/login");
  }, [locked, router]);

  if (isSupabaseConfigured && (session === undefined || (detached && membership === "loading"))) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">…</div>;
  }
  if (locked) return null;
  if (detached) {
    const tr = lang === "tr";
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="font-display text-lg font-semibold">
            {tr ? "Hesabınız henüz bir kliniğe bağlı değil" : "Your account isn't linked to a clinic yet"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr
              ? "Randevox kurulumunu ekibimiz yapar. Kliniğiniz için hesap açıldıysa size iletilen e-posta adresiyle giriş yapın; açılmadıysa bizimle iletişime geçin."
              : "Our team sets Randevox up for you. If an account was created for your clinic, sign in with the email address we sent you; otherwise, get in touch."}
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {tr ? "Çıkış yap" : "Sign out"}
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
