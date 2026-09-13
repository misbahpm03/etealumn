import { DashboardShell } from "@/components/layout/dashboard-shell";
import { portalNavItems } from "@/features/portal/navigation";
import { routes } from "@/lib/routes";

/**
 * Member portal shell. Route protection and session handling arrive with
 * authentication in a later phase — see the shell's placeholder note.
 */
export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DashboardShell
      title="Member Portal"
      brandMark="MP"
      homeHref={routes.portal.dashboard}
      items={portalNavItems}
    >
      {children}
    </DashboardShell>
  );
}
