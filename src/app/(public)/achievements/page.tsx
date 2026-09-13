import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Achievements" };

export default function AchievementsPage() {
  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="Community"
        title="Achievements"
        description="Awards, recognitions, and milestones from the community."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The public achievements wall will show only approved, publicly visible entries."
          planned={[
            "Achievements listing with categories",
            "Member-submitted entries with moderation",
            "Privacy-aware attribution",
          ]}
        />
      </div>
    </Container>
  );
}
