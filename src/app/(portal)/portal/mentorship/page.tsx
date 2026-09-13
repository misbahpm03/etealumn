import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mentorship" };

export default function PortalMentorshipPage() {
  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="Mentorship"
        description="Find a mentor or offer guidance to fellow members."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Mentorship is member-only: mentor discovery, requests, and session coordination will live here."
          planned={[
            "Mentor profiles and availability",
            "Mentorship requests and matching",
            "Session scheduling and notes",
          ]}
        />
      </div>
    </>
  );
}
