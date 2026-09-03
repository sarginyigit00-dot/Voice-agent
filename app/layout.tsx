import type { Metadata } from "next";
// ── FONTS ─────────────────────────────────────────────────────────────────
// Randevox runs on Sora — a geometric, techy sans for the UI — paired with JetBrains
// Mono for every number, metric and call transcript. Distinctive and
// engineered-feeling, not the generic Inter/Roboto look. Keep the CSS variable
// names (--font-sans-app / --font-display-app / --font-mono-app) so globals.css
// picks them up. The setup may swap these for per-brand variety.
import { Sora, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { SessionProvider } from "@/components/auth/session";
import appConfig from "@/app.config";
import { DEFAULT_LANG } from "@/lib/i18n/config";

const sans = Sora({
  variable: "--font-sans-app",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// Sora doubles as the display family — heavier weight, tighter tracking.
const display = Sora({
  variable: "--font-display-app",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-app",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Editorial serif for the landing page — whisper-weight 300 headlines with an
// italic accent line. Deliberately NOT bold: authority through restraint.
const serif = Source_Serif_4({
  variable: "--font-serif-app",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: `${appConfig.name} — ${appConfig.tagline[DEFAULT_LANG]}`,
  description: appConfig.description[DEFAULT_LANG],
  applicationName: appConfig.name,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // NOTE: `dark` is deliberately NOT hardcoded on <html> — next-themes owns
  // that class. Hardcoding it makes React fight the toggle back on re-render
  // and freezes the whole app in dark. defaultTheme="dark" keeps dark-first.
  return (
    <html
      lang={DEFAULT_LANG}
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} ${serif.variable} h-full`}
    >
      <body className="min-h-full bg-background text-foreground antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            {/*
              One SessionProvider for the whole app, not just the cockpit —
              /login and /signup need a real `enterDemo()` too (the default
              context value is a no-op), and a single instance means the demo
              flag survives navigating in and out of the cockpit rather than
              re-reading localStorage from a fresh mount each time.
            */}
            <SessionProvider>{children}</SessionProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
