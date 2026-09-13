import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentForm } from "@/features/archive/document-form";
import {
  listActiveDocumentCategories,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";

export const metadata: Metadata = { title: "New Submission" };

export default async function PortalArchiveNewPage() {
  await requireActiveUser();
  const categories = await listActiveDocumentCategories();
  return (
    <>
      <PageHeader
        eyebrow="Academic archive"
        title="New submission"
        description="Create a private draft — nothing is shared until you submit it for review."
      />
      <div className="mt-8">
        <DocumentForm categories={categories} />
      </div>
    </>
  );
}
