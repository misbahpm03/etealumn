import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Users"
        description="Approve members, manage roles, and handle suspensions."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="User administration — approvals, roles, statuses — will live here, fully audit-logged."
          planned={[
            "Pending member approvals",
            "Role and status management",
            "Suspension and deactivation workflows",
          ]}
        />
      </div>
    </>
  );
}
