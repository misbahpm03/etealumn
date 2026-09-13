import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Stories" };

export default function AdminStoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Stories"
        description="Moderate member stories and manage publication."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Story moderation — review, approval, and publication controls — will live here."
          planned={[
            "Story review queue",
            "Publish and unpublish controls",
            "Removal with audit trail",
          ]}
        />
      </div>
    </>
  );
}
