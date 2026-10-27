"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/session";
import { useLang } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { authedFetch } from "@/lib/supabase/authed-fetch";
import { cn } from "@/lib/utils";
import type { ContractDocument } from "@/lib/contracts/text";

type State =
  | { status: "loading" }
  /** Nothing to accept, already accepted, or the lookup failed — the panel opens. */
  | { status: "open" }
  | {
      status: "required";
      documents: ContractDocument[];
      digest: string;
      /** An older version was accepted: this is an update, not a first contract. */
      updated: boolean;
      support: boolean;
    };

/**
 * Hizmet Sözleşmesi + Veri İşleme Sözleşmesi, accepted with two ticks before
 * the panel opens (lib/contracts/server.ts). Only once the operator has filled
 * the clinic's terms in /admin; until then there's nothing to accept and the
 * panel opens as before. The hard stop is elsewhere: /admin won't connect the
 * phone line without a current acceptance.
 *
 * A failed lookup opens the panel — this screen asks for consent, it isn't
 * what keeps data apart. The support account sees a strip instead, and can't
 * accept on the clinic's behalf.
 */
export function ContractGate({ children }: { children: React.ReactNode }) {
  const { session, demo } = useSession();
  const { lang } = useLang();
  const tr = lang === "tr";
  const real = isSupabaseConfigured && !demo && !!session;
  const [state, setState] = useState<State>(() => (real ? { status: "loading" } : { status: "open" }));

  useEffect(() => {
    if (!real) return;
    let cancelled = false;
    authedFetch("/api/clinic/contract")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        if (body?.status !== "required") return setState({ status: "open" });
        setState({
          status: "required",
          documents: body.documents,
          digest: body.digest,
          updated: Boolean(body.accepted),
          support: Boolean(body.support),
        });
      })
      .catch(() => !cancelled && setState({ status: "open" }));
    return () => {
      cancelled = true;
    };
  }, [real]);

  if (!real || state.status === "open") return <>{children}</>;
  if (state.status === "loading") {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">…</div>;
  }
  if (state.support) {
    return (
      <>
        <div className="border-b border-warning/40 bg-warning/10 px-4 py-1.5 text-center text-xs font-medium text-warning-foreground">
          {tr
            ? "Bu klinik sözleşmeyi henüz kabul etmedi. Klinik giriş yaptığında kabul ekranını görecek."
            : "This clinic hasn't accepted the contract yet. Its staff will see the acceptance screen when they sign in."}
        </div>
        {children}
      </>
    );
  }
  return <AcceptScreen {...state} onAccepted={() => setState({ status: "open" })} />;
}

function AcceptScreen({
  documents,
  digest,
  updated,
  onAccepted,
}: {
  documents: ContractDocument[];
  digest: string;
  updated: boolean;
  onAccepted: () => void;
}) {
  const { signOut } = useSession();
  const { lang } = useLang();
  const tr = lang === "tr";
  const [tab, setTab] = useState(0);
  const [accept, setAccept] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doc = documents[tab];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch("/api/clinic/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest, accept, authorized }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? (tr ? "Kaydedilemedi." : "Could not save."));
      onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-semibold">
          {updated
            ? tr
              ? "Sözleşmeniz güncellendi"
              : "Your contract has been updated"
            : tr
              ? "Başlamadan önce: sözleşmeler"
              : "Before you start: the contracts"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tr
            ? "Panele geçmeden önce Hizmet Sözleşmesi'ni ve Veri İşleme Sözleşmesi'ni okuyup kabul etmeniz gerekir. Kabulden sonra iki sözleşmenin tam metni e-posta adresinize gönderilir."
            : "Before entering the panel, please read and accept the Service Agreement and the Data Processing Agreement (in Turkish). A full copy of both is e-mailed to you once you accept."}
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {documents.map((d, i) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setTab(i)}
            className={cn(
              "-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              i === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {d.title}
          </button>
        ))}
      </div>

      <article
        key={doc.id}
        className="h-[55dvh] overflow-y-auto rounded-lg border border-border bg-card/40 px-5 py-4 text-sm leading-relaxed"
      >
        <h2 className="text-center font-display text-base font-semibold uppercase tracking-wide">{doc.title}</h2>
        <p className="mb-4 text-center text-xs text-muted-foreground">{doc.subtitle}</p>
        {doc.sections.map((s, i) => (
          <section key={i} className="mb-4">
            <h3 className="mb-1.5 font-semibold">{s.title}</h3>
            {s.paragraphs.map((p, j) => (
              <p key={j} className="mb-1.5 text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>

      <div className="space-y-2.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            {tr
              ? "Hizmet Sözleşmesi'ni ve Veri İşleme Sözleşmesi'ni okudum, kabul ediyorum."
              : "I have read and accept the Service Agreement and the Data Processing Agreement."}
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            {tr
              ? "Bu sözleşmeleri kliniğimiz adına kabul etmeye yetkili olduğumu beyan ederim."
              : "I confirm I am authorised to accept these agreements on behalf of our clinic."}
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-missed">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!accept || !authorized || busy} onClick={() => void submit()}>
          {busy ? "…" : tr ? "Kabul et ve devam et" : "Accept and continue"}
        </Button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {tr ? "Çıkış yap" : "Sign out"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {tr
          ? "Kabul ettiğinizde hesabınız, tarih-saat, IP adresi ve sözleşme sürümü kayda geçer."
          : "Accepting records your account, the date and time, your IP address and the contract version."}
      </p>
    </div>
  );
}
