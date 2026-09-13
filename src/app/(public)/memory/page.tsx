import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Department Memory" };

export default function MemoryPage() {
  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="Heritage"
        title="Department Memory"
        description="Milestones, moments, and memorabilia from department history."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Department Memory will present curated historical entries managed in the admin CMS."
          planned={[
            "Timeline of department milestones",
            "Curated media galleries",
            "Admin-managed historical entries",
          ]}
        />
      </div>
    </Container>
  );
}
