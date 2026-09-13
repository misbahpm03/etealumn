import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Achievements" };

export default function PortalAchievementsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="Achievements"
        description="Record and showcase your awards and milestones."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Members will submit achievements for moderation and manage their showcase here."
          planned={[
            "Submit achievements with evidence",
            "Approval tracking",
            "Privacy controls per entry",
          ]}
        />
      </div>
    </>
  );
}
