import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ResendVerificationForm } from "@/features/auth/resend-verification-form";

export const metadata: Metadata = { title: "Verify Your Email" };

/**
 * Landing spot for signed-in users whose email is not confirmed yet.
 * Verification alone never grants membership — application status (via the
 * shared destination table) decides where the user goes next.
 */
export default function VerifyEmailPage() {
  return (
    <Container narrow className="py-10">
      <PageHeader
        eyebrow="Members"
        title="Check your inbox"
        description="Open the verification link we emailed you to continue. If the link expired, request a new one below."
      />
      <ResendVerificationForm />
    </Container>
  );
}
