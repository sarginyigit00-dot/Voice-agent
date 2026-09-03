import { isAdminConfigured, requireAdmin } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/queries";
import { getSystemHealth } from "@/lib/admin/health";
import { AdminLogin } from "./admin-login";
import { AdminPanel } from "./admin-panel";

/**
 * /admin — the operator's panel. Top-level on purpose: outside the (app) route
 * group, so none of the cockpit's chrome or its client-side AuthGate applies.
 * The gate here is server-side, because the data below is read with the
 * service-role key.
 *
 * Login and panel share this one URL: no session → the password form renders
 * in place, no redirect.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Yönetim paneli", robots: { index: false, follow: false } };

export default async function AdminPage() {
  return (
    <div className="ed-light min-h-dvh bg-background text-foreground">
      {await body()}
    </div>
  );
}

async function body() {
  if (!isAdminConfigured()) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-sm space-y-2 text-center">
          <h1 className="font-display text-xl font-semibold">Panel yapılandırılmamış</h1>
          <p className="text-sm text-muted-foreground">
            <code className="font-mono text-xs">.env.local</code> dosyasına{" "}
            <code className="font-mono text-xs">ADMIN_PASSWORD</code> ekleyip sunucuyu yeniden
            başlat.
          </p>
        </div>
      </div>
    );
  }

  if (!(await requireAdmin())) return <AdminLogin />;

  const [data, health] = await Promise.all([getAdminOverview(), getSystemHealth()]);
  return <AdminPanel data={data} health={health} />;
}
