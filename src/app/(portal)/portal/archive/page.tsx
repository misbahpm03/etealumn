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
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import { routes } from "@/lib/routes";
import type { DocumentSummary } from "@/types";

export const metadata: Metadata = { title: "Academic Archive" };

function SubmissionRow({ doc }: { doc: DocumentSummary }) {
  return (
    <li>
      <Link
        href={routes.portal.archiveDetail(doc.id)}
        className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-900">{doc.title}</span>
          <DocumentStatusBadge status={doc.status} />
          <DocumentVisibilityBadge visibility={doc.visibility} />
        </span>
        <span className="mt-1 block text-sm text-zinc-500">
          {[doc.year ? String(doc.year) : null, doc.supervisorName]
            .filter((part) => part !== null && part !== "")
            .join(" · ") || "No additional details"}
        </span>
      </Link>
    </li>
  );
}

export default async function PortalArchivePage() {
  const appUser = await requireActiveUser();
  const search = await createDocumentSearchService(appUser);
  const mine = await search.searchMember({ ownOnly: true });
  const isStaff = appUser.role === "MODERATOR" || appUser.role === "ADMIN";
  const submitted = isStaff
    ? await search.searchMember({ status: "SUBMITTED" })
    : null;
  const inReview = isStaff
    ? await search.searchMember({ status: "UNDER_REVIEW" })
    : null;
  const queue = [...(submitted?.rows ?? []), ...(inReview?.rows ?? [])];

  return (
    <>
      <PageHeader
        eyebrow="Member portal"
        title="Academic Archive"
        description="Your submissions and, for reviewers, the moderation queue."
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
                <SubmissionRow key={doc.id} doc={doc} />
              ))}
            </ul>
          )}
        </section>

        {isStaff ? (
          <section aria-label="Review queue">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              Review queue
            </h2>
            {queue.length === 0 ? (
              <Card>
                <p className="text-sm text-zinc-600">
                  Nothing waiting for review.
                </p>
              </Card>
            ) : (
              <ul className="flex flex-col gap-3">
                {queue.map((doc) => (
                  <SubmissionRow key={doc.id} doc={doc} />
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
