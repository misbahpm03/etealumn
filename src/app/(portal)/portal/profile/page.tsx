import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "My Profile" };

export default function PortalProfilePage() {
  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="My Profile"
        description="Manage your public and member-visible profile information."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Profile management — including career, education, and privacy controls — will live here."
          planned={[
            "Profile details and avatar",
            "Career and education history",
            "Granular privacy settings",
          ]}
        />
      </div>
    </>
  );
}
