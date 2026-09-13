import { DashboardShell } from "@/components/layout/dashboard-shell";
import { adminNavItems } from "@/features/admin/navigation";
import { routes } from "@/lib/routes";

/**
 * Admin CMS shell. Role checks and route protection arrive with
 * authentication/authorization in a later phase.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DashboardShell
      title="Admin CMS"
      brandMark="AD"
      homeHref={routes.admin.dashboard}
      items={adminNavItems}
    >
      {children}
    </DashboardShell>
  );
}
