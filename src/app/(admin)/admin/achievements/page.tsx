import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Achievements" };

export default function AdminAchievementsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Achievements"
        description="Verify member achievements and manage the public wall."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Achievement moderation — verification, approval, and showcase management — will live here."
          planned={[
            "Verification queue",
            "Approve and feature entries",
            "Category management",
          ]}
        />
      </div>
    </>
  );
}
