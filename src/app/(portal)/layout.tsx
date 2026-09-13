import { redirect } from "next/navigation";

/**
 * Guarded shell: must render per-request. Without this, the layout could
 * prerender statically (unauthenticated) at build time and serve that
 * snapshot to every visitor — the guard below would never run.
 */
export const dynamic = "force-dynamic";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { portalNavItems } from "@/features/portal/navigation";
import { getCurrentAppUser } from "@/infrastructure/supabase/server-session";
import { ServiceNotConfiguredError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { resolvePostAuthDestination } from "@/services/auth";

/**
 * Member portal shell. Server-side guard: only ACTIVE users whose resolved
 * destination is the portal may render (staff land in the admin shell).
 * Middleware applies the same table coarsely; RLS guards the data itself.
 */
export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    const appUser = await getCurrentAppUser();
    const destination = resolvePostAuthDestination(appUser);
    if (
      destination !== routes.portal.root &&
      !destination.startsWith(`${routes.portal.root}/`)
    ) {
      redirect(destination);
    }
  } catch (error) {
    if (!(error instanceof ServiceNotConfiguredError)) {
      throw error;
    }
    // Degraded: render unguarded so UI work continues without Supabase.
  }

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
