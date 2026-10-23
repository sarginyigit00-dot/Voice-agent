"use client";

import { useSession } from "@/components/auth/session";
import { useLang } from "@/components/i18n/language-provider";

/**
 * Shown only to the support account the operator signs in with from /admin
 * ("Panelini aç", lib/admin/support.ts), so it's never in doubt whose panel
 * this is and that the visit is a support one.
 */
export function SupportBanner() {
  const { session, clinic } = useSession();
  const { lang } = useLang();
  if (!session?.user.user_metadata?.support) return null;

  const name = clinic?.name ?? "…";
  return (
    <div className="border-b border-warning/40 bg-warning/10 px-4 py-1.5 text-center text-xs font-medium text-warning-foreground">
      {lang === "tr"
        ? `Destek modu — Randevox ekibi ${name} panelini görüntülüyor`
        : `Support mode — the Randevox team is viewing ${name}'s panel`}
    </div>
  );
}
