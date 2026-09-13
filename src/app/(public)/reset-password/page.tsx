import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { getCurrentAuthUser } from "@/infrastructure/supabase/server-session";
import { ServiceNotConfiguredError } from "@/lib/errors";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Set a New Password" };

/** Session-gated: always render per-request. */
export const dynamic = "force-dynamic";

/**
 * Reached via the emailed reset link (the callback establishes a recovery
 * session first). Visitors without any session are sent to sign-in; the
 * form itself works for recovery and regular sessions alike.
 */
export default async function ResetPasswordPage() {
  try {
    const identity = await getCurrentAuthUser();
    if (!identity) {
      redirect(routes.public.signIn);
    }
  } catch (error) {
    if (!(error instanceof ServiceNotConfiguredError)) {
      throw error;
    }
  }

  return (
    <Container narrow className="py-10">
      <PageHeader
        eyebrow="Members"
        title="Set a new password"
        description="Choose a new password for your account."
      />
      <ResetPasswordForm />
    </Container>
  );
}
