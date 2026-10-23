"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useLang } from "@/components/i18n/language-provider";
import { useSession } from "@/components/auth/session";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/logo";

/**
 * Where /admin → Klinikler → "Panelini aç" lands. The URL carries a one-time
 * token minted for the support account (lib/admin/support.ts); redeeming it
 * here signs this browser in as that account, which is attached to the chosen
 * clinic. Not linked from anywhere in the app.
 */
export default function SupportSignInPage() {
  const router = useRouter();
  const { lang } = useLang();
  const { exitDemo } = useSession();
  const [failed, setFailed] = useState(false);
  // The token works once, and this effect re-runs as the session changes under it (exitDemo isn't stable).
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const supabase = getSupabaseBrowser();
    const tokenHash = new URLSearchParams(window.location.search).get("token_hash");
    if (!supabase || !tokenHash) {
      setFailed(true);
      return;
    }

    (async () => {
      // Whoever was signed in on this browser before steps aside first.
      await supabase.auth.signOut({ scope: "local" });
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error) {
        console.error("[destek] sign-in failed:", error.message);
        setFailed(true);
        return;
      }
      exitDemo();
      router.replace("/dashboard");
    })();
  }, [router, exitDemo]);

  const tr = lang === "tr";
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo />
        {failed ? (
          <p className="text-sm text-missed">
            {tr
              ? "Destek girişi tamamlanamadı. Link tek kullanımlık; yönetim panelinden tekrar aç."
              : "Support sign-in didn't complete. The link works once; open it again from the admin panel."}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr ? "Destek girişi yapılıyor…" : "Signing in for support…"}
          </p>
        )}
      </div>
    </div>
  );
}
