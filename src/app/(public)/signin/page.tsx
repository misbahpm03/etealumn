import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { SignInForm } from "@/features/auth/sign-in-form";
import { getCurrentAppUser } from "@/infrastructure/supabase/server-session";
import { ServiceNotConfiguredError } from "@/lib/errors";
import {
  applySafeNext,
  resolvePostAuthDestination,
} from "@/services/auth";

export const metadata: Metadata = { title: "Sign In" };

/** Friendly copy for auth-callback failures (unknown codes stay generic). */
const CALLBACK_ERRORS: Record<string, string> = {
  "link-expired":
    "That link has expired or was already used. Request a new one below.",
  "link-invalid": "That link is invalid. Request a new one below.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  let configured = true;
  try {
    const appUser = await getCurrentAppUser();
    if (appUser) {
      redirect(
        applySafeNext(resolvePostAuthDestination(appUser), params.next),
      );
    }
  } catch (error) {
    if (error instanceof ServiceNotConfiguredError) {
      configured = false;
    } else {
      throw error;
    }
  }

  const callbackError = params.error
    ? (CALLBACK_ERRORS[params.error] ??
      "Something went wrong. Please try again.")
    : null;

  return (
    <Container narrow className="py-10">
      <PageHeader
        eyebrow="Members"
        title="Sign In"
        description="Access the member portal or the admin CMS."
      />
      {!configured ? (
        <p
          role="status"
          className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          The authentication service is not configured in this environment,
          so sign-in is unavailable.
        </p>
      ) : null}
      {callbackError ? (
        <p
          role="alert"
          className="mt-8 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {callbackError}
        </p>
      ) : null}
      <SignInForm next={params.next} />
    </Container>
  );
}
