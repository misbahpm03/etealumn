import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  ArchiveActionButton,
} from "@/features/archive/archive-actions";
import {
  DocumentStatusBadge,
  DocumentVisibilityBadge,
} from "@/features/archive/document-badges";
import {
  createAcademicDocumentService,
  createDocumentSearchService,
  listActiveDocumentCategories,
  listBatches,
  requireAnyRole,
} from "@/infrastructure/supabase/server-session";
import { routes } from "@/lib/routes";
import type { ReviewQueueItem } from "@/types";

export const metadata: Metadata = { title: "Archive Moderation" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function QueueRow({ item }: { item: ReviewQueueItem }) {
  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-zinc-900">{item.title}</p>
          <DocumentStatusBadge status={item.status} />
          <DocumentVisibilityBadge visibility={item.visibility} />
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {item.ownerDisplayName} · {item.categoryName}
          {item.batchName ? ` · ${item.batchName}` : ""} · submitted{" "}
          {item.submittedAt ? formatDate(item.submittedAt) : "—"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href={routes.api.archiveDownload(item.id)}
            className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
          >
            Download file
          </a>
          {item.status === "SUBMITTED" ? (
            <ArchiveActionButton
              action="beginReview"
              documentId={item.id}
              label="Begin review"
              pendingLabel="Starting…"
              variant="primary"
            />
          ) : null}
          {item.status === "UNDER_REVIEW" ? (
            <>
              <ArchiveActionButton
                action="approve"
                documentId={item.id}
                label="Approve"
                pendingLabel="Approving…"
                variant="primary"
              />
              <ArchiveActionButton
                action="reject"
                documentId={item.id}
                label="Reject"
                pendingLabel="Rejecting…"
                confirmMessage="Reject this document? The owner can reopen it as a draft."
              />
            </>
          ) : null}
        </div>
      </Card>
    </li>
  );
}

export default async function AdminArchivePage() {
  const appUser = await requireAnyRole(["MODERATOR", "ADMIN"]);
  const service = await createAcademicDocumentService(appUser);
  const search = await createDocumentSearchService(appUser);
  const [queue, approved, categories, batches] = await Promise.all([
    service.listReviewQueue(),
    search.searchMember({ status: "APPROVED" }),
    listActiveDocumentCategories(),
    listBatches(),
  ]);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const batchNames = new Map(batches.map((b) => [b.id, b.name]));

  return (
    <>
      <PageHeader
        eyebrow="Admin CMS"
        title="Archive moderation"
        description="Review submissions and archive approved documents."
      />
      <div className="mt-8 flex max-w-3xl flex-col gap-10">
        <section aria-label="Awaiting review">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            Awaiting review
          </h2>
          {queue.length === 0 ? (
            <EmptyState
              title="Queue is clear"
              description="No documents are waiting for review."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {queue.map((item) => (
                <QueueRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Approved documents">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            Approved — ready to archive
          </h2>
          {approved.rows.length === 0 ? (
            <Card>
              <p className="text-sm text-zinc-600">
                No approved documents are currently visible to you.
              </p>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {approved.rows.map((doc) => (
                <li key={doc.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-900">{doc.title}</p>
                      <DocumentVisibilityBadge visibility={doc.visibility} />
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {categoryNames.get(doc.categoryId) ?? "Unknown category"}
                      {doc.batchId
                        ? ` · ${batchNames.get(doc.batchId) ?? "Unknown batch"}`
                        : ""}
                    </p>
                    <div className="mt-3">
                      <ArchiveActionButton
                        action="archive"
                        documentId={doc.id}
                        label="Archive"
                        pendingLabel="Archiving…"
                        confirmMessage="Archive this document? It will leave the public listing."
                      />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-zinc-500">
            Only documents your role may read appear here — moderators see
            public and faculty-tier approvals, admins see everything.
          </p>
        </section>
      </div>
    </>
  );
}
