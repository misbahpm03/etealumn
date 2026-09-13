import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  DocumentStatusBadge,
  DocumentVisibilityBadge,
} from "@/features/archive/document-badges";
import {
  createDocumentSearchService,
  listActiveDocumentCategories,
  listBatches,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import { routes } from "@/lib/routes";
import type { DocumentSummary } from "@/types";

export const metadata: Metadata = { title: "Academic Archive" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SubmissionRow({
  doc,
  categoryName,
  batchName,
  showEdit,
}: {
  doc: DocumentSummary;
  categoryName: string;
  batchName: string | null;
  showEdit: boolean;
}) {
  return (
    <li>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50">
        <Link
          href={routes.portal.archiveDetail(doc.id)}
          className="block"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-zinc-900">{doc.title}</span>
            <DocumentStatusBadge status={doc.status} />
            <DocumentVisibilityBadge visibility={doc.visibility} />
          </span>
          <span className="mt-1 block text-sm text-zinc-500">
            {categoryName}
            {batchName ? ` · ${batchName}` : ""}
            {doc.year ? ` · ${doc.year}` : ""} · updated{" "}
            {formatDate(doc.updatedAt)}
          </span>
        </Link>
        {showEdit &&
        (doc.status === "DRAFT" || doc.status === "REJECTED") ? (
          <span className="mt-2 block text-sm">
            <Link
              href={routes.portal.archiveEdit(doc.id)}
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Continue editing
            </Link>
          </span>
        ) : null}
      </div>
    </li>
  );
}

export default async function PortalArchivePage() {
  const appUser = await requireActiveUser();
  const search = await createDocumentSearchService(appUser);
  const [mine, categories, batches] = await Promise.all([
    search.searchMember({ ownOnly: true }),
    listActiveDocumentCategories(),
    listBatches(),
  ]);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const batchNames = new Map(batches.map((b) => [b.id, b.name]));
  const nameOf = (id: string) => categoryNames.get(id) ?? "Unknown category";
  const batchOf = (id: string | null) =>
    id ? (batchNames.get(id) ?? "Unknown batch") : null;

  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="Academic Archive"
        description="Your submissions, drafts, and rejected documents awaiting resubmission."
      />
      <div className="mt-8 flex max-w-3xl flex-col gap-10">
        <section aria-label="My submissions">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">
              My submissions
            </h2>
            <Link
              href={routes.portal.archiveNew}
              className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700"
            >
              New submission
            </Link>
          </div>
          {mine.rows.length === 0 ? (
            <EmptyState
              title="No submissions yet"
              description="Drafts start private — submit one for review when it is ready."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {mine.rows.map((doc) => (
                <SubmissionRow
                  key={doc.id}
                  doc={doc}
                  categoryName={nameOf(doc.categoryId)}
                  batchName={batchOf(doc.batchId)}
                  showEdit={doc.ownerId === appUser.id}
                />
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-zinc-500">
            Open a document for version history, review actions, and —
            for rejected documents — the path back to editing.
          </p>
        </section>

        <section aria-label="Review queue notice">
          <Card>
            <p className="text-sm text-zinc-600">
              Reviewers work from the moderation queue in the admin area;
              document pages show the review actions available to you.
            </p>
          </Card>
        </section>
      </div>
    </>
  );
}
