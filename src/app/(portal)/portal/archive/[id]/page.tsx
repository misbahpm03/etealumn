import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  ArchiveActionButton,
  RevokeGrantButton,
  VisibilityForm,
} from "@/features/archive/archive-actions";
import { GrantForm } from "@/features/archive/grant-form";
import {
  DocumentStatusBadge,
  DocumentVisibilityBadge,
} from "@/features/archive/document-badges";
import { VersionForm } from "@/features/archive/version-form";
import {
  createAcademicDocumentService,
  createDocumentPermissionService,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import { ValidationError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { isUuid } from "@/validations/common";
import type {
  Document,
  DocumentPermission,
  DocumentVersion,
  SessionUser,
} from "@/types";

interface DetailParams {
  id: string;
}

async function loadDetail(id: string, appUser: SessionUser) {
  // Fail fast on malformed ids without touching infrastructure (the
  // service re-validates regardless — this is only a cheap route gate).
  if (!isUuid(id)) return null;
  try {
    const service = await createAcademicDocumentService(appUser);
    const doc = await service.getDocument(id);
    if (!doc) return null;
    const versions = await service.listVersions(id);
    return { doc, versions };
  } catch (error) {
    // Malformed ids read as not-found (no oracle, no 500).
    if (error instanceof ValidationError) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<DetailParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const appUser = await requireActiveUser();
  const detail = await loadDetail(id, appUser);
  // 404 here (not just a fallback title) so the status engages before
  // the page shell streams; the page-level notFound() below is the
  // backstop.
  if (!detail) notFound();
  return { title: `${detail.doc.title} — Archive` };
}

function MetadataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-900 sm:col-span-2">{children}</dd>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PortalArchiveDetailPage({
  params,
}: {
  params: Promise<DetailParams>;
}) {
  const { id } = await params;
  const appUser = await requireActiveUser();
  const detail = await loadDetail(id, appUser);
  if (!detail) notFound();
  const { doc, versions }: { doc: Document; versions: ReadonlyArray<DocumentVersion> } =
    detail;

  const isOwner = doc.ownerId === appUser.id;
  const isStaff = appUser.role === "MODERATOR" || appUser.role === "ADMIN";
  const isAdmin = appUser.role === "ADMIN";
  const isEditable = doc.status === "DRAFT" || doc.status === "REJECTED";
  const showVisibility = isAdmin || (isOwner && isEditable);
  const showVersionForm = isOwner && isEditable;
  const showDelete =
    isAdmin ||
    (isOwner &&
      (doc.status === "DRAFT" ||
        doc.status === "REJECTED" ||
        doc.status === "SUBMITTED"));

  const managesGrants = isOwner || isAdmin;
  const permissionService =
    await createDocumentPermissionService(appUser);
  const grants: ReadonlyArray<DocumentPermission> = managesGrants
    ? await permissionService.listPermissions(doc.id)
    : [];
  const myGrants =
    !managesGrants && !isStaff
      ? await permissionService.myPermissions(doc.id)
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Academic archive"
        title={doc.title}
        description={doc.description ?? "No description provided."}
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DocumentStatusBadge status={doc.status} />
        <DocumentVisibilityBadge visibility={doc.visibility} />
        {doc.allowDownload ? null : (
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200">
            Downloads off
          </span>
        )}
      </div>

      <div className="mt-8 flex max-w-3xl flex-col gap-10">
        <section aria-label="Details">
          <Card>
            <dl className="flex flex-col gap-3">
              <MetadataRow label="File">
                {doc.originalFilename} · {formatBytes(doc.fileSize)} ·{" "}
                {doc.mimeType}
              </MetadataRow>
              {doc.abstract ? (
                <MetadataRow label="Abstract">{doc.abstract}</MetadataRow>
              ) : null}
              <MetadataRow label="Year">{doc.year ?? "—"}</MetadataRow>
              <MetadataRow label="Supervisor">
                {doc.supervisorName ?? "—"}
              </MetadataRow>
              <MetadataRow label="Keywords">
                {doc.keywords && doc.keywords.length > 0
                  ? doc.keywords.join(", ")
                  : "—"}
              </MetadataRow>
              <MetadataRow label="Last updated">
                {formatDate(doc.updatedAt)}
              </MetadataRow>
              {doc.status === "APPROVED" && doc.approvedAt ? (
                <MetadataRow label="Approved">
                  {formatDate(doc.approvedAt)}
                </MetadataRow>
              ) : null}
            </dl>
            <div className="mt-5 border-t border-zinc-200 pt-5">
              <a
                href={routes.api.archiveDownload(doc.id)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Download current file
              </a>
              <p className="mt-2 text-sm text-zinc-500">
                Access is verified on every request; the link never exposes
                storage locations.
              </p>
            </div>
          </Card>
        </section>

        {showVisibility || showVersionForm || showDelete ? (
          <section aria-label="Manage">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              Manage
            </h2>
            <div className="flex flex-col gap-6">
              {showVisibility ? (
                <VisibilityForm documentId={doc.id} current={doc.visibility} />
              ) : null}
              {showVersionForm ? <VersionForm documentId={doc.id} /> : null}
              {isOwner && isEditable ? (
                <Link
                  href={routes.portal.archiveEdit(doc.id)}
                  className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
                >
                  Edit metadata
                </Link>
              ) : null}
              {showDelete ? (
                <ArchiveActionButton
                  action="softDelete"
                  documentId={doc.id}
                  label="Delete document"
                  pendingLabel="Deleting…"
                  confirmMessage="Delete this document? It will be hidden immediately; files are retained."
                  variant="danger"
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {managesGrants || myGrants.length > 0 ? (
          <section aria-label="Permissions">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              Permissions
            </h2>
            {managesGrants ? (
              <div className="flex flex-col gap-6">
                <GrantForm documentId={doc.id} />
                <div>
                  <h3 className="mb-2 text-sm font-medium text-zinc-900">
                    Active grants
                  </h3>
                  {grants.length === 0 ? (
                    <p className="text-sm text-zinc-600">
                      No explicit grants. Visibility and review roles
                      decide access.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {grants.map((grant) => (
                        <li
                          key={grant.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                        >
                          <span className="text-zinc-700">
                            <span className="font-medium text-zinc-900">
                              {grant.permission}
                            </span>{" "}
                            · {grant.userId.slice(0, 8)}…
                            {grant.expiresAt
                              ? ` · expires ${formatDate(grant.expiresAt)}`
                              : " · no expiry"}
                          </span>
                          <RevokeGrantButton
                            documentId={doc.id}
                            userId={grant.userId}
                            permission={grant.permission}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <Card>
                <p className="text-sm text-zinc-600">
                  Your access:{" "}
                  {myGrants
                    .map(
                      (grant) =>
                        `${grant.permission}${grant.expiresAt ? ` (expires ${formatDate(grant.expiresAt)})` : ""}`,
                    )
                    .join(", ")}
                </p>
              </Card>
            )}
          </section>
        ) : null}

        <section aria-label="Review">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            Review
          </h2>
          <div className="flex flex-wrap gap-3">
            {isOwner && doc.status === "DRAFT" ? (
              <ArchiveActionButton
                action="submit"
                documentId={doc.id}
                label="Submit for review"
                pendingLabel="Submitting…"
                variant="primary"
              />
            ) : null}
            {(isOwner || isStaff) && doc.status === "REJECTED" ? (
              <ArchiveActionButton
                action="reopen"
                documentId={doc.id}
                label="Reopen as draft"
                pendingLabel="Reopening…"
                variant="primary"
              />
            ) : null}
            {isStaff && doc.status === "SUBMITTED" ? (
              <ArchiveActionButton
                action="beginReview"
                documentId={doc.id}
                label="Begin review"
                pendingLabel="Starting…"
                variant="primary"
              />
            ) : null}
            {isStaff && doc.status === "UNDER_REVIEW" ? (
              <>
                <ArchiveActionButton
                  action="approve"
                  documentId={doc.id}
                  label="Approve"
                  pendingLabel="Approving…"
                  variant="primary"
                />
                <ArchiveActionButton
                  action="reject"
                  documentId={doc.id}
                  label="Reject"
                  pendingLabel="Rejecting…"
                  confirmMessage="Reject this document? The owner can reopen it as a draft."
                />
              </>
            ) : null}
            {isStaff && doc.status === "APPROVED" ? (
              <ArchiveActionButton
                action="archive"
                documentId={doc.id}
                label="Archive"
                pendingLabel="Archiving…"
                confirmMessage="Archive this document? It will leave the public listing."
              />
            ) : null}
            {!isOwner && !isStaff ? (
              <p className="text-sm text-zinc-600">
                No review actions are available for this document.
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            Every transition is validated and audited server-side — buttons
            shown here are convenience only.
          </p>
        </section>

        <section aria-label="Version history">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            Version history
          </h2>
          {versions.length === 0 ? (
            <Card>
              <p className="text-sm text-zinc-600">No versions recorded.</p>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {versions.map((version) => (
                <li key={version.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-900">
                        Version {version.versionNumber} ·{" "}
                        {version.originalFilename}
                      </p>
                      <a
                        href={`${routes.api.archiveDownload(doc.id)}?version=${version.versionNumber}`}
                        className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
                      >
                        Download
                      </a>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatBytes(version.fileSize)} ·{" "}
                      {formatDate(version.createdAt)}
                      {version.changeNote
                        ? ` · ${version.changeNote}`
                        : ""}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
