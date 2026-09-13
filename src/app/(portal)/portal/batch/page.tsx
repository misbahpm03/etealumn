import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "My Batch" };

export default function PortalBatchPage() {
  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="My Batch"
        description="Connect with members of your cohort."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The batch view will show cohort members, batch updates, and shared resources."
          planned={[
            "Batch member directory",
            "Batch announcements",
            "Cohort statistics",
          ]}
        />
      </div>
    </>
  );
}
