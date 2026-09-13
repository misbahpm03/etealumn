import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="Academic archive"
        title="Archive"
        description="Theses, papers, and reports approved for public viewing."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The public archive will expose only documents that are both PUBLIC and approved/published."
          planned={[
            "Search by title, author, supervisor, category, year, and keywords",
            "Document detail pages with version history",
            "Authorized downloads via signed URLs",
          ]}
        />
      </div>
    </Container>
  );
}
