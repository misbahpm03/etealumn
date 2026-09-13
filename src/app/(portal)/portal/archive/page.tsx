import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Academic Archive" };

export default function PortalArchivePage() {
  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="Academic Archive"
        description="Browse member-visible documents and manage your submissions."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Members will browse visibility-filtered documents and track their own submissions through review."
          planned={[
            "Visibility-aware document search",
            "Submit thesis, papers, and reports",
            "Track submission status and versions",
          ]}
        />
      </div>
    </>
  );
}
