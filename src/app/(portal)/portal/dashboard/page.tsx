import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function PortalDashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="Dashboard"
        description="Your activity, updates, and shortcuts across the platform."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The member dashboard will summarize notifications, pending actions, and recent activity."
          planned={[
            "Activity and notification summary",
            "Quick links to profile, archive, and batch",
            "Pending mentorship and opportunity updates",
          ]}
        />
      </div>
    </>
  );
}
