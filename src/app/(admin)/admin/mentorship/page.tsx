import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mentorship" };

export default function AdminMentorshipPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Mentorship"
        description="Oversee mentor profiles, requests, and program health."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Mentorship oversight — mentor verification and dispute handling — will live here."
          planned={[
            "Mentor verification",
            "Request and session oversight",
            "Program reports",
          ]}
        />
      </div>
    </>
  );
}
