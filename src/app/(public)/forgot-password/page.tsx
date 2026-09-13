import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return (
    <Container narrow className="py-10">
      <PageHeader
        eyebrow="Members"
        title="Reset your password"
        description="Enter your account email and we'll send you a reset link."
      />
      <ForgotPasswordForm />
    </Container>
  );
}
