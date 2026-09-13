import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Notifications" };

export default function AdminNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Notifications"
        description="Broadcast announcements and manage notification templates."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Admin notifications — broadcasts and templates — will live here."
          planned={[
            "Compose batch and platform announcements",
            "Notification templates",
            "Delivery history",
          ]}
        />
      </div>
    </>
  );
}
