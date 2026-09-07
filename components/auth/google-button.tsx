"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useLang } from "@/components/i18n/language-provider";
import { useSession } from "@/components/auth/session";
import { getSupabaseBrowser, setSessionPersistence } from "@/lib/supabase/client";
import {
  GOOGLE_CLIENT_ID,
  initGoogleIdentity,
  type GoogleCredentialResponse,
} from "@/lib/auth/google-gis";

/** Google's four-colour mark, for the fallback button. Their terms require the original colours. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

type Mode = "loading" | "gis" | "redirect";

/**
 * "Continue with Google", by two roads:
 *
 *  1. GIS (preferred) — Google renders its own button here, the visitor picks
 *     an account in a popup that never leaves this origin, and the returned ID
 *     token is exchanged with `signInWithIdToken`. Nothing about the Supabase
 *     project is shown to the visitor.
 *  2. Redirect (fallback) — the classic `signInWithOAuth` round-trip through
 *     `<project>.supabase.co/auth/v1/callback` and back to /auth/callback.
 *     Used whenever road 1 can't be taken: no NEXT_PUBLIC_GOOGLE_CLIENT_ID,
 *     the gsi script blocked (ad blocker, offline, corporate proxy), or the
 *     origin not allow-listed in Google Cloud.
 *
 * Both roads need the same remember-me handling: the choice has to be written
 * BEFORE the token arrives, because it decides which store it lands in. The
 * value is mirrored into a ref — GIS's callback is registered once and would
 * otherwise close over whatever the box said at mount.
 *
 * Renders nothing at all when Supabase isn't configured; there's no provider
 * to talk to in the demo bypass.
 */
export function GoogleButton({ remember, disabled }: { remember: boolean; disabled?: boolean }) {
  const { ui, lang } = useLang();
  const router = useRouter();
  const { exitDemo } = useSession();
  const [mode, setMode] = useState<Mode>(GOOGLE_CLIENT_ID ? "loading" : "redirect");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slot = useRef<HTMLDivElement | null>(null);
  const rememberRef = useRef(remember);
  // Mirrored in an effect, not during render — writing a ref while rendering
  // is what the refs lint rule (rightly) forbids.
  useEffect(() => {
    rememberRef.current = remember;
  }, [remember]);

  const supabase = getSupabaseBrowser();
  const hasSupabase = Boolean(supabase);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !hasSupabase) return;

    let cancelled = false;

    async function signIn(response: GoogleCredentialResponse, rawNonce: string) {
      const client = getSupabaseBrowser();
      if (cancelled || !client) return;
      setBusy(true);
      setError(null);
      // Same ordering rule as the password path — this picks the store.
      setSessionPersistence(rememberRef.current);

      const { error: err } = await client.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
        nonce: rawNonce,
      });

      if (err) {
        setError(err.message);
        setBusy(false);
        return;
      }
      // A Google account is real credentials — it always beats sample data.
      exitDemo();
      router.push("/dashboard");
    }

    (async () => {
      try {
        const api = await initGoogleIdentity(GOOGLE_CLIENT_ID!, (response, rawNonce) =>
          void signIn(response, rawNonce),
        );
        if (cancelled || !slot.current) return;

        slot.current.replaceChildren();
        api.renderButton(slot.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          locale: lang,
          // Google needs a pixel width; match whatever the form column is.
          width: Math.min(400, Math.round(slot.current.offsetWidth) || 360),
        });

        setMode("gis");
      } catch {
        // Script blocked or Google unreachable — the redirect road still works.
        if (!cancelled) setMode("redirect");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang, exitDemo, router, hasSupabase]);

  if (!supabase) return null;

  /** The fallback road: hand the browser to Google and come back to /auth/callback. */
  async function startRedirect() {
    setError(null);
    setBusy(true);
    setSessionPersistence(rememberRef.current);

    const { error: err } = await supabase!.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    // On success the browser is already leaving, so only failure lands here.
    if (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {ui.orSeparator}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Google paints its own button in here. Kept mounted (just hidden) while
          the script loads, so the ref exists when renderButton is called. */}
      <div
        ref={slot}
        className={
          mode === "gis" && !busy
            ? "flex min-h-10 justify-center [color-scheme:light]"
            : "h-0 overflow-hidden"
        }
      />

      {mode === "loading" && (
        <div className="flex h-10 items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {(mode === "redirect" || busy) && (
        <button
          type="button"
          onClick={startRedirect}
          disabled={busy || disabled}
          className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleMark className="h-[18px] w-[18px]" />
          )}
          {busy ? ui.signingInWithGoogle : ui.continueWithGoogle}
        </button>
      )}

      {error && (
        <p className="rounded-lg bg-missed/10 px-3 py-2 text-center text-xs text-missed">{error}</p>
      )}
    </div>
  );
}
