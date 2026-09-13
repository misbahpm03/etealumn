import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Batches" };

export default function BatchesPage() {
  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="Community"
        title="Batches"
        description="Cohorts by admission and graduation year."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The public batch index will list batches with aggregate, privacy-safe information."
          planned={[
            "Batch listing by year",
            "Batch overview pages",
            "Links to public batch member profiles",
          ]}
        />
      </div>
    </Container>
  );
}
