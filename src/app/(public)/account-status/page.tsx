import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { SignOutButton } from "@/features/auth/sign-out-button";
import {
  getCurrentAppUser,
  getCurrentAuthUser,
} from "@/infrastructure/supabase/server-session";
import { ServiceNotConfiguredError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { resolvePostAuthDestination } from "@/services/auth";
import type { SessionUser, UserStatus } from "@/types";

export const metadata: Metadata = { title: "Account Status" };

/** Session-dependent copy: always render per-request. */
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<
  Exclude<UserStatus, "ACTIVE">,
  { title: string; description: string }
> = {
  PENDING: {
    title: "Account pending review",
    description:
      "Your account exists but hasn't been approved yet. You'll get full access once an administrator activates it.",
  },
  SUSPENDED: {
    title: "Account suspended",
    description:
      "Your account is currently suspended, so member areas are unavailable. Please contact support for help.",
  },
  DEACTIVATED: {
    title: "Account deactivated",
    description:
      "Your account is currently deactivated, so member areas are unavailable. Please contact support for help.",
  },
};

/**
 * Restricted-state landing page: signed-in users whose application status
 * is not ACTIVE (or whose app row is missing) wait here instead of entering
 * the portal/admin shells. Anything routable elsewhere self-heals away.
 */
export default async function AccountStatusPage() {
  let appUser: SessionUser | null = null;
  let signedIn = false;
  let misconfigured = false;
  try {
    appUser = await getCurrentAppUser();
    signedIn =
      appUser !== null || (await getCurrentAuthUser()) !== null;
  } catch (error) {
    if (error instanceof ServiceNotConfiguredError) {
      misconfigured = true;
    } else {
      throw error;
    }
  }

  if (!misconfigured) {
    if (!signedIn) {
      redirect(routes.public.signIn);
    }
    if (appUser) {
      const destination = resolvePostAuthDestination(appUser);
      if (destination !== routes.public.accountStatus) {
        redirect(destination);
      }
    }
  }

  // Reachable only when this page IS the destination (non-ACTIVE status),
  // when the app row is missing, or when auth is unconfigured.
  let title = "Account setup incomplete";
  let description =
    "Your sign-in worked but your application account is missing. Please contact support.";
  if (misconfigured) {
    title = "Service unavailable";
    description =
      "The authentication service is not configured in this environment.";
  } else if (appUser && appUser.status !== "ACTIVE") {
    ({ title, description } = STATUS_COPY[appUser.status]);
  }

  return (
    <Container narrow className="py-10">
      <PageHeader eyebrow="Members" title={title} description={description} />
      <div className="mt-8">
        <SignOutButton />
      </div>
    </Container>
  );
}
