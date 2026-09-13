import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Opportunities" };

export default function AdminOpportunitiesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Opportunities"
        description="Moderate member-posted jobs, internships, and collaborations."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Opportunity moderation — spam control, approvals, and expiry management — will live here."
          planned={[
            "Posting review queue",
            "Approve, reject, and expire listings",
            "Abuse reports",
          ]}
        />
      </div>
    </>
  );
}
