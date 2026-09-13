import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Sign In" };

export default function SignInPage() {
  return (
    <Container narrow className="py-10">
      <PageHeader
        eyebrow="Members"
        title="Sign In"
        description="Access the member portal or the admin CMS."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Authentication is not implemented in the foundation phase. The sign-in form, session handling, and route protection will arrive with the AuthProvider implementation in a later phase."
          planned={[
            "Email and password sign-in",
            "Role-aware redirects (portal vs admin)",
            "Session persistence and sign-out",
          ]}
        />
      </div>
    </Container>
  );
}
