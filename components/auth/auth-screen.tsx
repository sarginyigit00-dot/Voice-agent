"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import appConfig from "@/app.config";
import { useLang } from "@/components/i18n/language-provider";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useSession } from "@/components/auth/session";

/**
 * Login / signup against Supabase Auth when it's configured, with a DEMO
 * BYPASS that still drops you straight into the cockpit. Signing up writes an
 * `auth.users` row; the `on_auth_user_created` trigger mirrors it into
 * `public.profiles` (id, email, full_name, role).
 *
 * Demo mode has exactly one door in — the `/demo` route — and this screen is
 * the way back out: every path that ends in a real session calls exitDemo()
 * first, so signing in for real in a tab that was showing sample data always
 * lands on real data. (It used to be the other way round — SessionProvider
 * wiped the flag whenever any session existed — which made the sample cockpit
 * unreachable for anyone already signed in.)
 */
export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const { ui, t, lang } = useLang();
  const router = useRouter();
  const { enterDemo, exitDemo } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Signup only: once signUp() returns a user but no session, we switch to a
  // "enter the code we emailed you" step instead of the password form.
  const [step, setStep] = useState<"form" | "verify">("form");
  const [pendingEmail, setPendingEmail] = useState("");

  function handleDemo(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    enterDemo();
    setTimeout(() => router.push("/dashboard"), 450);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return handleDemo();

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("name") ?? "").trim();

    setLoading(true);
    setError(null);
    setNotice(null);

    const res = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });

    if (res.error) {
      setError(res.error.message);
      setLoading(false);
      return;
    }

    // Sign-up with email confirmation on returns a user but no session — the
    // account exists, it just can't be used until the code is verified.
    if (!res.data.session) {
      setPendingEmail(email);
      setStep("verify");
      setLoading(false);
      return;
    }

    // Real credentials always beat the sample data, even if this tab was
    // showing it a moment ago.
    exitDemo();
    router.push("/dashboard");
  }

  async function submitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return handleDemo();

    const form = new FormData(e.currentTarget);
    const token = String(form.get("code") ?? "").trim();

    setLoading(true);
    setError(null);
    setNotice(null);

    const res = await supabase.auth.verifyOtp({ email: pendingEmail, token, type: "signup" });

    if (res.error) {
      setError(ui.invalidCode);
      setLoading(false);
      return;
    }

    // Same reasoning as the password path above.
    exitDemo();
    router.push("/dashboard");
  }

  async function resendCode() {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setError(null);
    setNotice(null);
    const res = await supabase.auth.resend({ type: "signup", email: pendingEmail });
    setNotice(res.error ? res.error.message : ui.codeResent);
  }

  const isLogin = mode === "login";
  const stats = appConfig.marketing.stats.slice(0, 3);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Left — brand panel */}
      <section
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ backgroundImage: "var(--grad-brand)" }}
      >
        <span className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-16 -left-10 h-64 w-64 rounded-full bg-black/15 blur-3xl" />

        <Link href="/" className="relative">
          <Logo onDark />
        </Link>

        <div className="relative max-w-md">
          <p className="text-xs uppercase tracking-[0.22em] text-white/70">
            {t(appConfig.marketing.badge)}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">
            {t(appConfig.tagline)}
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/85">{ui.authBlurb}</p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.value} className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                <p className="font-display text-2xl font-semibold tabular-nums">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-white/75">{t(s.label)}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/65">
          © {appConfig.name} · {appConfig.domain}
        </p>
      </section>

      {/* Right — form */}
      <section className="ed-light relative flex flex-col items-center justify-center bg-background px-6 py-12">
        <div className="absolute right-5 top-5">
          <LanguageToggle />
        </div>

        <div className="w-full max-w-sm space-y-7">
          <Link href="/" className="inline-flex lg:hidden">
            <Logo />
          </Link>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {appConfig.name}
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">
              {step === "verify" ? ui.enterCode : isLogin ? ui.welcomeBack : ui.createAccount}
            </h2>
            {step === "verify" && (
              <p className="mt-1 text-sm text-muted-foreground">
                {ui.codeSentTo} <span className="font-medium text-foreground">{pendingEmail}</span>
              </p>
            )}
          </div>

          {step === "verify" ? (
            <form onSubmit={submitCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">{ui.enterCode}</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  placeholder="123456"
                  className="text-center text-lg tracking-[0.4em]"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {ui.verifyCode}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>

              {error && (
                <p className="rounded-lg bg-missed/10 px-3 py-2 text-center text-xs text-missed">{error}</p>
              )}
              {notice && (
                <p className="rounded-lg bg-booked/10 px-3 py-2 text-center text-xs text-booked">{notice}</p>
              )}

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                >
                  {ui.backToForm}
                </button>
                <button
                  type="button"
                  onClick={resendCode}
                  className="font-medium text-primary hover:underline underline-offset-4 cursor-pointer"
                >
                  {ui.resendCode}
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={submit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{ui.fullName}</Label>
                    <Input id="name" name="name" placeholder={lang === "tr" ? "Adın Soyadın" : "Jane Doe"} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">{ui.email}</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{ui.password}</Label>
                  <Input id="password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required minLength={6} placeholder="••••••••" />
                </div>
                <Button type="submit" disabled={loading} className="w-full gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isLogin ? ui.signIn : ui.getStarted}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>

                {error && (
                  <p className="rounded-lg bg-missed/10 px-3 py-2 text-center text-xs text-missed">{error}</p>
                )}
                {notice && (
                  <p className="rounded-lg bg-booked/10 px-3 py-2 text-center text-xs text-booked">{notice}</p>
                )}
              </form>

              <p className="text-center text-sm text-muted-foreground">
                {isLogin ? ui.noAccount : ui.haveAccount}{" "}
                <Link
                  href={isLogin ? "/signup" : "/login"}
                  className="font-medium text-primary hover:underline underline-offset-4"
                >
                  {isLogin ? ui.getStarted : ui.signIn}
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
