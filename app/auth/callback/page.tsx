"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";
import { useSession } from "@/components/auth/session";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/logo";

/**
 * Where Google sends the visitor back. Nothing here talks to Google directly:
 * the browser client is created with `detectSessionInUrl: true`, so simply
 * mounting on a URL that carries `?code=…` makes supabase-js exchange it for a
 * session (PKCE — the verifier is read back out of the same store the
 * remember-me choice picked). All this page does is wait for that to land and
 * then get out of the way.
 *
 * Two failure shapes are handled: Google itself refusing (an `error` param —
 * usually the visitor pressing Cancel), and the exchange never producing a
 * session, which in practice means the callback URL isn't in Supabase's
 * redirect allow-list.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { ui } = useLang();
  const { exitDemo } = useSession();
  // Google's own refusal (usually the visitor pressing Cancel) is already in
  // the URL at first paint, so it's read in the initializer — an effect that
  // set it would cost an extra render for a state we can know up front.
  const [failed, setFailed] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("error"),
  );

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      router.replace("/login");
      return;
    }

    if (failed) return;

    let done = false;
    function arrive() {
      if (done) return;
      done = true;
      // A Google account is real credentials — it always beats sample data.
      exitDemo();
      router.replace("/dashboard");
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) arrive();
    });
    // The exchange may have finished before this component mounted.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) arrive();
    });

    // Nothing arrived — the redirect URL is almost certainly not allow-listed.
    const giveUp = setTimeout(() => {
      if (!done) setFailed(true);
    }, 10_000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(giveUp);
    };
  }, [router, exitDemo, failed]);

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo />
        {failed ? (
          <>
            <p className="text-sm text-missed">{ui.googleSignInFailed}</p>
            <Link
              href="/login"
              className="text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              {ui.signIn}
            </Link>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {ui.signingInWithGoogle}
          </p>
        )}
      </div>
    </div>
  );
}
