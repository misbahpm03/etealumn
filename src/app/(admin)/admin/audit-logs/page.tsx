import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Audit Logs" };

export default function AdminAuditLogsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Audit Logs"
        description="Append-only record of administrative and security-sensitive actions."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The audit log viewer — filterable, exportable, and tamper-evident — will live here."
          planned={[
            "Filter by actor, action, and date",
            "Immutable log entries",
            "CSV export for compliance",
          ]}
        />
      </div>
    </>
  );
}
