import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Stories" };

export default function PortalStoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="Stories"
        description="Write and manage your stories for the community."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Members will draft, submit, and manage stories through the moderation workflow here."
          planned={[
            "Story editor with drafts",
            "Submission and approval tracking",
            "Manage published stories",
          ]}
        />
      </div>
    </>
  );
}
