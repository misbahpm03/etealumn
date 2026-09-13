import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentEditForm } from "@/features/archive/document-edit-form";
import {
  createAcademicDocumentService,
  listActiveDocumentCategories,
  listBatches,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import { ValidationError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { isUuid } from "@/validations/common";
import type { Document, SessionUser } from "@/types";

interface EditParams {
  id: string;
}

async function loadDocument(
  id: string,
  appUser: SessionUser,
): Promise<Document | null> {
  // Fail fast on malformed ids without touching infrastructure (the
  // service re-validates regardless — this is only a cheap route gate).
  if (!isUuid(id)) return null;
  try {
    const service = await createAcademicDocumentService(appUser);
    return await service.getDocument(id);
  } catch (error) {
    // Malformed ids read as not-found (no oracle, no 500).
    if (error instanceof ValidationError) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<EditParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const appUser = await requireActiveUser();
  const doc = await loadDocument(id, appUser);
  // 404 here (not just a fallback title) so the status engages before
  // the page shell streams; the page-level notFound() below is the
  // backstop.
  if (!doc) notFound();
  return { title: `Edit ${doc.title} — Archive` };
}

export default async function PortalArchiveEditPage({
  params,
}: {
  params: Promise<EditParams>;
}) {
  const { id } = await params;
  const appUser = await requireActiveUser();
  const doc = await loadDocument(id, appUser);
  // Edit URLs are owner-only and unguessable: non-owners read 404 (no
  // oracle), whatever their view rights on the document itself.
  if (!doc || doc.ownerId !== appUser.id) notFound();
  const editable = doc.status === "DRAFT" || doc.status === "REJECTED";

  if (!editable) {
    return (
      <>
        <PageHeader
          eyebrow="Academic archive"
          title={`Edit ${doc.title}`}
          description="This document is locked for editing."
        />
        <div className="mt-8 max-w-2xl">
          <Card>
            <p className="text-sm text-zinc-600">
              Documents can only be edited while in DRAFT or REJECTED
              status. This document is {doc.status.replace("_", " ")}.
            </p>
            <Link
              href={routes.portal.archiveDetail(doc.id)}
              className="mt-3 inline-block text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Back to the document
            </Link>
          </Card>
        </div>
      </>
    );
  }

  const [categories, batches] = await Promise.all([
    listActiveDocumentCategories(),
    listBatches(),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Academic archive"
        title={`Edit ${doc.title}`}
        description="Update the submission metadata — the lifecycle lock is enforced server-side."
      />
      <div className="mt-8">
        <DocumentEditForm doc={doc} categories={categories} batches={batches} />
      </div>
    </>
  );
}
