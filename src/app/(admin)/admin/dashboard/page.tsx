import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Dashboard"
        description="Platform overview, moderation queues, and pending approvals."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The CMS dashboard will surface moderation queues, pending approvals, and platform metrics."
          planned={[
            "Pending users, documents, stories, and achievements",
            "Recent audit activity",
            "Platform growth metrics",
          ]}
        />
      </div>
    </>
  );
}
