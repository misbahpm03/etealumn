import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Batches" };

export default function AdminBatchesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Batches"
        description="Create and manage graduation cohorts."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Batch management — creation, member assignment, and batch metadata — will live here."
          planned={[
            "Create and edit batches",
            "Assign members to batches",
            "Batch statistics",
          ]}
        />
      </div>
    </>
  );
}
