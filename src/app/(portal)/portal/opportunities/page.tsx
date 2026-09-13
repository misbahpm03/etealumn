import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Opportunities" };

export default function PortalOpportunitiesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="Opportunities"
        description="Jobs, internships, and collaborations shared within the community."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Opportunities are member-only and will be listed, posted, and moderated here."
          planned={[
            "Member-only opportunity listings",
            "Post and manage opportunities",
            "Application tracking",
          ]}
        />
      </div>
    </>
  );
}
