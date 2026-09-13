import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function PortalSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="Settings"
        description="Account preferences, security, and privacy defaults."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Account settings — password, sessions, notification defaults, and privacy — will live here."
          planned={[
            "Change password and manage sessions",
            "Notification preferences",
            "Account deactivation requests",
          ]}
        />
      </div>
    </>
  );
}
