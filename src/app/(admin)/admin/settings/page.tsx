import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "System Settings" };

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="System Settings"
        description="Platform configuration, policies, and integrations."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="System settings — site config, policies, and provider status — will live here."
          planned={[
            "Site and department information",
            "Content and privacy policies",
            "Provider and integration status",
          ]}
        />
      </div>
    </>
  );
}
