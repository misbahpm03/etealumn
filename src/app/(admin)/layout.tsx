import { redirect } from "next/navigation";

/**
 * Guarded shell: must render per-request (see portal layout note).
 */
export const dynamic = "force-dynamic";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { adminNavItems } from "@/features/admin/navigation";
import { getCurrentAppUser } from "@/infrastructure/supabase/server-session";
import { ServiceNotConfiguredError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { resolvePostAuthDestination } from "@/services/auth";

/**
 * Admin CMS shell. Server-side guard: only ACTIVE staff (moderator/admin —
 * the destination table mirrors `is_staff()`) may render. This is a UX
 * boundary; RLS remains the authorization layer for every query.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    const appUser = await getCurrentAppUser();
    const destination = resolvePostAuthDestination(appUser);
    if (
      destination !== routes.admin.root &&
      !destination.startsWith(`${routes.admin.root}/`)
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
      title="Admin CMS"
      brandMark="AD"
      homeHref={routes.admin.dashboard}
      items={adminNavItems}
    >
      {children}
    </DashboardShell>
  );
}
