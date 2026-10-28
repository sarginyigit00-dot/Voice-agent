import { TopNav } from "@/components/app/top-nav";
import { StatusBar } from "@/components/app/status-bar";
import { FeedbackWidget } from "@/components/app/feedback-widget";
import { AppThemeProvider } from "@/components/app/app-theme";
import { AuthGate } from "@/components/auth/session";
import { SupportBanner } from "@/components/app/support-banner";
import { ContractGate } from "@/components/app/contract-gate";
import { UsagePing } from "@/components/app/usage-ping";

// SessionProvider lives in the root layout now — every route shares it,
// including /login and /signup, which need a real enterDemo() too.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGate>
      <AppThemeProvider>
        <ContractGate>
          <SupportBanner />
          <TopNav />
          <main className="flex-1 overflow-y-auto">{children}</main>
          <StatusBar />
          <FeedbackWidget />
          <UsagePing />
        </ContractGate>
      </AppThemeProvider>
    </AuthGate>
  );
}
