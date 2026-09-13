import { routes } from "@/lib/routes";
import type { SessionUser } from "@/types";

/**
 * Post-authentication routing table. Pure (no I/O, no `server-only`) so the
 * login action, auth pages, layouts, AND edge/node middleware share one
 * decision — routing can never drift between layers.
 *
 * Rules: verification before status, status before role. Role decides only
 * which shell an ACTIVE user lands in; FACULTY shares the portal shell
 * (there is no faculty-only surface yet).
 */
export function resolvePostAuthDestination(
  appUser: SessionUser | null,
): string {
  if (!appUser) {
    return routes.public.signIn;
  }
  if (!appUser.emailVerifiedAt) {
    return routes.public.verifyEmail;
  }
  switch (appUser.status) {
    case "PENDING":
    case "SUSPENDED":
    case "DEACTIVATED":
      return routes.public.accountStatus;
    case "ACTIVE":
      break;
  }
  switch (appUser.role) {
    case "ADMIN":
    case "MODERATOR":
      return routes.admin.dashboard;
    case "STUDENT":
    case "ALUMNI":
    case "FACULTY":
      return routes.portal.dashboard;
  }
}

/**
 * Open-redirect guard for `next` parameters: same-origin absolute app paths
 * only. Rejects protocol-relative URLs (`//evil`), backslash tricks
 * (`/\evil`, embedded `\`), and non-strings.
 */
export function resolveSafeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  if (!value.startsWith("/")) {
    return null;
  }
  if (value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}

/**
 * Honor a requested `next` path only when it stays inside the resolved
 * destination's shell — a portal user can return to `/portal/archive` but
 * never get bounced into `/admin/*` (or vice versa) via a crafted link.
 */
export function applySafeNext(destination: string, next: unknown): string {
  const safe = resolveSafeNextPath(next);
  if (!safe) {
    return destination;
  }
  const shellOf = (path: string): string | null => {
    if (path === "/portal" || path.startsWith("/portal/")) return "/portal";
    if (path === "/admin" || path.startsWith("/admin/")) return "/admin";
    return null;
  };
  const destinationShell = shellOf(destination);
  if (
    destinationShell !== null &&
    shellOf(safe) === destinationShell
  ) {
    return safe;
  }
  return destination;
}
