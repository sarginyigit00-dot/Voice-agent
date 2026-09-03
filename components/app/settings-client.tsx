"use client";

import { useTheme } from "next-themes";
import { CheckCircle2, CircleDashed } from "lucide-react";
import appConfig from "@/app.config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useLang } from "@/components/i18n/language-provider";
import { LANGS, LANG_LABEL } from "@/lib/i18n/config";
import { usePrefs } from "@/lib/prefs";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

/** A pill group where exactly one option is active — used for theme + language. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | undefined;
  options: { value: T; label: string; icon?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-violet text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.icon && <Icon name={o.icon} className="h-3.5 w-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A labelled on/off switch row. */
function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors",
          checked ? "border-transparent bg-violet" : "border-border bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

/**
 * What each integration means to the business owner. The cockpit never shows
 * vendor names or env keys — the technical health view lives in the admin panel.
 */
const SERVICE_LABEL: Record<string, { tr: string; en: string }> = {
  vapi: { tr: "Telefon hattı", en: "Phone line" },
  twilio: { tr: "Numara ve SMS", en: "Numbers and SMS" },
  openai: { tr: "Konuşma zekâsı", en: "Conversation intelligence" },
  calendar: { tr: "Takvim", en: "Calendar" },
  crm: { tr: "Müşteri kaydı (CRM)", en: "Customer records (CRM)" },
  supabase: { tr: "Veri ve hesaplar", en: "Data and accounts" },
};

const SERVICE_PURPOSE: Record<string, { tr: string; en: string }> = {
  vapi: { tr: "Gelen aramaları ajanınız karşılar ve konuşur.", en: "Your agent answers and speaks on inbound calls." },
  twilio: { tr: "Telefon numarası, SMS ve arama transferi.", en: "Phone number, SMS and call transfer." },
  openai: { tr: "Arayanı anlar, talimatlarınıza göre karar verir.", en: "Understands the caller and follows your instructions." },
  calendar: { tr: "Ajan takviminize gerçek randevu yazar.", en: "The agent writes real appointments to your calendar." },
  crm: { tr: "Her arama kişi kartına ve geçmişine işlenir.", en: "Every call is filed to a contact and its history." },
  supabase: { tr: "Aramalar, ajanlar ve kayıtlar güvenle saklanır.", en: "Calls, agents and records are stored securely." },
};

export function SettingsClient({
  keyStatus,
}: {
  keyStatus: Record<string, Record<string, boolean>>;
}) {
  const { t, ui, lang, setLang } = useLang();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // next-themes only knows the real theme after hydration; render the control
  // in a neutral state until then so server and client markup agree.
  const mounted = useMounted();

  // Switches apply instantly (like theme and language) and are shared with the
  // status bar and the cockpit, so there is nothing to "save" on this page.
  const { prefs, update: setPref } = usePrefs();

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">{ui.settings}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{ui.settingsHint}</p>
      </div>

      {/* Appearance — theme + language */}
      <Card>
        <CardHeader>
          <CardTitle>{ui.appearance}</CardTitle>
          <p className="text-sm text-muted-foreground">{ui.appearanceHint}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{ui.theme}</p>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {mounted ? resolvedTheme : "—"}
              </p>
            </div>
            <Segmented
              label={ui.theme}
              value={mounted ? (theme as "system" | "light" | "dark") : undefined}
              onChange={(v) => setTheme(v)}
              options={[
                { value: "system", label: ui.themeSystem, icon: "monitor" },
                { value: "light", label: ui.themeLight, icon: "sun" },
                { value: "dark", label: ui.themeDark, icon: "moon" },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{ui.language}</p>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {LANG_LABEL[lang]}
              </p>
            </div>
            <Segmented
              label={ui.language}
              value={lang}
              onChange={setLang}
              options={LANGS.map((l) => ({ value: l, label: LANG_LABEL[l], icon: "languages" }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cockpit preferences */}
      <Card>
        <CardHeader>
          <CardTitle>{ui.preferences}</CardTitle>
          <p className="text-sm text-muted-foreground">{ui.preferencesHint}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            title={ui.prefRecording}
            hint={ui.prefRecordingHint}
            checked={prefs.recording}
            onChange={(v) => setPref({recording: v })}
          />
          <ToggleRow
            title={ui.prefNotifications}
            hint={ui.prefNotificationsHint}
            checked={prefs.notifications}
            onChange={(v) => setPref({notifications: v })}
          />
          <ToggleRow
            title={ui.prefLiveTicker}
            hint={ui.prefLiveTickerHint}
            checked={prefs.liveTicker}
            onChange={(v) => setPref({liveTicker: v })}
          />
        </CardContent>
      </Card>

      {/* Service status — plain-language, no vendor names or keys */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "tr" ? "Sistem durumu" : "System status"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {lang === "tr"
              ? "Kurulumun hangi parçalarının çalıştığı. Bir şey beklemedeyse bizimle iletişime geçin."
              : "Which parts of your setup are live. If something is pending, get in touch with us."}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {appConfig.integrations.map((it) => {
            const keys = keyStatus[it.key] ?? {};
            // Only the required env vars decide "connected" — optionalEnvVars
            // (e.g. an external CRM webhook) are shown but never gate it.
            const values = it.envVars.map((v) => !!keys[v]);
            const connected = values.length > 0 && (it.anyOf ? values.some(Boolean) : values.every(Boolean));
            const label = SERVICE_LABEL[it.key] ?? { tr: it.name, en: it.name };
            const purpose = SERVICE_PURPOSE[it.key];
            return (
              <div key={it.key} className="flex items-start gap-4 rounded-lg border border-border p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Icon name="plug" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t(label)}</p>
                  {purpose && <p className="mt-0.5 text-sm text-muted-foreground">{t(purpose)}</p>}
                </div>
                {connected ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" /> {lang === "tr" ? "Aktif" : "Active"}
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <CircleDashed className="h-4 w-4" /> {lang === "tr" ? "Beklemede" : "Pending"}
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

    </div>
  );
}
