import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Department Memory" };

export default function AdminMemoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Department Memory"
        description="Curate historical entries, timelines, and media galleries."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="Department Memory curation — entries, timelines, and media — will live here."
          planned={[
            "Historical entry editor",
            "Timeline ordering",
            "Media gallery management",
          ]}
        />
      </div>
    </>
  );
}
