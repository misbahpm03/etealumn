import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Stories" };

export default function StoriesPage() {
  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="Community"
        title="Stories"
        description="Journeys and reflections from students, alumni, and faculty."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The public stories collection will show only approved, publicly visible stories."
          planned={[
            "Story listing and reader pages",
            "Author attribution with privacy controls",
            "Moderation and approval workflow",
          ]}
        />
      </div>
    </Container>
  );
}
