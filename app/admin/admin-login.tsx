"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/**
 * The /admin door: one password field, nothing else. No email, no account —
 * on success the server sets a signed httpOnly cookie and router.refresh()
 * re-renders the same URL as the panel.
 */
export function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");

    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Giriş yapılamadı.");
      setLoading(false);
      return;
    }

    // The cookie is already set on the response; refresh re-runs the server
    // component, which now sees it and renders the panel.
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">Yönetim paneli</h1>
          <p className="mt-1 text-sm text-muted-foreground">Devam etmek için şifreyi gir.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Giriş yap
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>

          {error && (
            <p className="rounded-lg bg-missed/10 px-3 py-2 text-center text-xs text-missed">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
