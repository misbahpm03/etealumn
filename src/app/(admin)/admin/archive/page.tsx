import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Academic Archive" };

export default function AdminArchivePage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Academic Archive"
        description="Review submissions and manage documents, categories, and versions."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Archive moderation — review queues, approvals, categories, and version management — will live here."
          planned={[
            "Submission review queue",
            "Approve, reject, and request changes",
            "Archive category management",
          ]}
        />
      </div>
    </>
  );
}
