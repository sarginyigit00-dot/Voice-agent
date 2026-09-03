import { TopNav } from "@/components/app/top-nav";
import { StatusBar } from "@/components/app/status-bar";
import { AppThemeProvider } from "@/components/app/app-theme";
import { AuthGate } from "@/components/auth/session";

// SessionProvider lives in the root layout now — every route shares it,
// including /login and /signup, which need a real enterDemo() too.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGate>
      <AppThemeProvider>
        <TopNav />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <StatusBar />
      </AppThemeProvider>
    </AuthGate>
  );
}
