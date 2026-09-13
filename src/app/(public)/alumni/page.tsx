import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Alumni" };

export default function AlumniPage() {
  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="Community"
        title="Alumni"
        description="Graduates of the department, shown according to their privacy settings."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The public alumni directory will list only profiles that members have made publicly visible."
          planned={[
            "Search and filter by batch, company, industry, and location",
            "Privacy-aware profile cards",
            "Public alumni profile pages",
          ]}
        />
      </div>
    </Container>
  );
}
