"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import appConfig from "@/app.config";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useAppTheme } from "@/components/app/app-theme";
import { useLang } from "@/components/i18n/language-provider";
import { useSession } from "@/components/auth/session";
import { usePrefs } from "@/lib/prefs";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchCalls } from "@/lib/calls/queries";
import { CALLS, type CallRow } from "@/lib/demo/data";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  icon: string;
  tint: string;
  title: { tr: string; en: string };
  detail: { tr: string; en: string };
  time: string;
}

const OUTCOME_NOTIFICATION: Record<string, { icon: string; tint: string; title: { tr: string; en: string } }> = {
  booked: { icon: "calendar-check", tint: "var(--color-booked)", title: { tr: "Yeni randevu", en: "New booking" } },
  transferred: { icon: "phone-forwarded", tint: "var(--color-transfer)", title: { tr: "Arama transfer edildi", en: "Call transferred" } },
  voicemail: { icon: "voicemail", tint: "var(--color-voicemail)", title: { tr: "Yeni sesli mesaj", en: "New voicemail" } },
  resolved: { icon: "check-circle-2", tint: "var(--color-booked)", title: { tr: "Arama tamamlandı", en: "Call handled" } },
  missed: { icon: "phone-missed", tint: "var(--color-missed)", title: { tr: "Cevapsız arama", en: "Missed call" } },
};

/** The bell only ever shows real calls — the three most recent ones. */
function toNotifications(calls: CallRow[]): Notification[] {
  return calls.slice(0, 3).map((c) => {
    const meta = OUTCOME_NOTIFICATION[c.outcome] ?? OUTCOME_NOTIFICATION.resolved;
    return {
      id: c.id,
      icon: meta.icon,
      tint: meta.tint,
      title: meta.title,
      detail: { tr: `${c.caller} — ${c.number}`, en: `${c.caller} — ${c.number}` },
      time: c.time,
    };
  });
}

const BUSINESS_PHONE = process.env.NEXT_PUBLIC_BUSINESS_PHONE?.trim();

/** The dark cockpit top nav: logo + tab nav + search + bell + number + user. */
export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, ui } = useLang();
  const { isDark, toggle: toggleTheme } = useAppTheme();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const alertsRef = useRef<HTMLDivElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const { profile, session, demo, signOut } = useSession();
  const { prefs } = usePrefs();
  // The bell mirrors the same call log the cockpit shows: real rows once
  // Supabase is connected, the sample log inside the demo bypass.
  const [notifications, setNotifications] = useState<Notification[]>(() => toNotifications(CALLS));

  useEffect(() => {
    if (!isSupabaseConfigured || demo) return;
    fetchCalls().then((rows) => { if (rows !== null) setNotifications(toNotifications(rows)); });
  }, [demo]);

  // The demo persona owns the whole tour — a real name here next to sample
  // call data would read as that person's actual account. It's also the
  // fallback when nobody is signed in, so the cockpit is never an empty shell.
  const displayName = demo
    ? "Alex"
    : profile?.full_name?.trim() || session?.user.email?.split("@")[0] || "Alex";
  const initials = displayName.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "AJ";

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!alertsOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setAlertsOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAlertsOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onEscape);
    };
  }, [alertsOpen]);

  const runSearch = () => {
    const q = query.trim();
    router.push(q ? `/calls?q=${encodeURIComponent(q)}` : "/calls");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-1 px-3 sm:px-4">
        {/* Mobile/tablet nav toggle */}
        <button
          aria-label={lang === "tr" ? "Menü" : "Menu"}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
          className="mr-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Icon name={navOpen ? "x" : "menu"} className="h-[18px] w-[18px]" />
        </button>

        {/* Left: brand */}
        <Link href="/dashboard" className="mr-2 flex items-center">
          <Logo />
        </Link>

        {/* Tab nav */}
        <nav className="hidden items-center lg:flex">
          {appConfig.nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon name={item.icon} className="h-3.5 w-3.5" />
                {t(item.label)}
                {active && <span className="absolute inset-x-2 -bottom-[7px] h-0.5 rounded-full bg-violet" />}
              </Link>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Search */}
          <div className="hidden h-8 w-56 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[13px] text-muted-foreground xl:flex focus-within:border-violet/50">
            <Icon name="search" className="h-3.5 w-3.5 shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
                if (e.key === "Escape") {
                  setQuery("");
                  searchRef.current?.blur();
                }
              }}
              placeholder={lang === "tr" ? "Arama veya ajan ara…" : "Search calls or agents…"}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {!query && (
              <kbd className="ml-auto shrink-0 rounded border border-border bg-muted px-1.5 text-[10px] font-semibold">/</kbd>
            )}
          </div>

          {/* Sample-data badge — only in the demo tour, so nobody mistakes the
              example calls for their own clinic's traffic. */}
          {demo && (
            <span
              title={lang === "tr" ? "Bu panel örnek verilerle doludur." : "This panel is filled with sample data."}
              className="hidden items-center gap-1.5 rounded-md border border-violet/40 bg-violet-soft px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-violet sm:inline-flex"
            >
              <Icon name="flask-conical" className="h-3 w-3" />
              {lang === "tr" ? "Örnek veri" : "Sample data"}
            </span>
          )}

          <LanguageToggle className="hidden sm:inline-flex" />
          <button
            aria-label="Toggle theme"
            title={isDark ? (lang === "tr" ? "Açık tema" : "Light") : (lang === "tr" ? "Koyu tema" : "Dark")}
            onClick={toggleTheme}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon name={isDark ? "sun" : "moon"} className="h-[17px] w-[17px]" />
          </button>

          <div ref={alertsRef} className="relative">
            <button
              aria-label="Alerts"
              aria-expanded={alertsOpen}
              onClick={() => setAlertsOpen((o) => !o)}
              className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon name="bell" className="h-[17px] w-[17px]" />
              {prefs.notifications && notifications.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet ring-2 ring-background" />
              )}
            </button>

            {alertsOpen && (
              <div className="animate-float-up absolute right-0 top-[calc(100%+8px)] w-80 rounded-lg border border-border bg-popover shadow-pop">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="text-[13px] font-semibold">{lang === "tr" ? "Bildirimler" : "Notifications"}</p>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {notifications.length} {lang === "tr" ? "yeni" : "new"}
                  </span>
                </div>
                {notifications.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">
                    {lang === "tr" ? "Yeni bildirim yok." : "No new notifications."}
                  </p>
                ) : (
                <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.id} className="flex items-start gap-2.5 px-3 py-2.5">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in oklch, ${n.tint} 16%, transparent)` }}>
                        <Icon name={n.icon} className="h-3.5 w-3.5" style={{ color: n.tint }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium leading-tight">{lang === "tr" ? n.title.tr : n.title.en}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{lang === "tr" ? n.detail.tr : n.detail.en}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{n.time}</span>
                    </li>
                  ))}
                </ul>
                )}
              </div>
            )}
          </div>

          {/* Active number pill — only shown once a real line is configured */}
          {BUSINESS_PHONE && (
            <Link
              href="/settings"
              className="hidden cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[12.5px] font-semibold transition-colors hover:bg-muted sm:inline-flex"
            >
              <Icon name="phone" className="h-3.5 w-3.5 text-violet" />
              <span className="tabular-nums">{BUSINESS_PHONE}</span>
            </Link>
          )}

          {/* User pill */}
          <Link
            href="/settings"
            title={session?.user.email ?? undefined}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card py-1 pl-1 pr-2 text-[13px] font-medium transition-colors hover:bg-muted"
          >
            <span className="grid h-6 w-6 place-items-center rounded bg-violet-soft font-mono text-[11px] font-bold text-violet">{initials}</span>
            <span className="hidden sm:inline">{displayName}</span>
          </Link>

          {(session || demo) && (
            <button
              onClick={signOut}
              aria-label={ui.logout}
              title={ui.logout}
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon name="log-out" className="h-[17px] w-[17px]" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile/tablet nav drawer */}
      {navOpen && (
        <nav className="border-t border-border bg-background px-2 py-2 lg:hidden">
          {appConfig.nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[14px] font-medium transition-colors",
                  active ? "bg-violet-soft text-violet" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon name={item.icon} className="h-4 w-4" />
                {t(item.label)}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
