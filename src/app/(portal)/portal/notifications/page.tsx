import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Notifications" };

export default function PortalNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="Notifications"
        description="Updates about your submissions, requests, and community activity."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The notification center will aggregate moderation updates, mentions, and reminders."
          planned={[
            "Notification inbox with read state",
            "Preferences per notification type",
            "Email digest settings",
          ]}
        />
      </div>
    </>
  );
}
