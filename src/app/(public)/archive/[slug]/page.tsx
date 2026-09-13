import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import {
  createDocumentSearchService,
  getCurrentAppUser,
} from "@/infrastructure/supabase/server-session";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { isValidDocumentSlug } from "@/validations/documents";
import type { PublicDocument } from "@/types";

/**
 * Caching: force-dynamic — an approval reverting or a visibility change
 * must disappear immediately, and no shared cache may retain details.
 */
export const dynamic = "force-dynamic";

interface DocumentParams {
  slug: string;
}

async function loadDocument(slug: string): Promise<PublicDocument | null> {
  // Fail fast on malformed slugs without touching infrastructure (the
  // service re-validates regardless — this is only a cheap route gate).
  if (!isValidDocumentSlug(slug)) return null;
  try {
    const search = await createDocumentSearchService(null);
    return await search.getPublicBySlug(slug);
  } catch (error) {
    // Malformed/unknown slugs read as not-found (no oracle, no 500).
    if (error instanceof ValidationError) return null;
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<DocumentParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await loadDocument(slug);
  // 404 here (not just a fallback title) so the status engages before the
  // page shell streams; the page-level notFound() below is the backstop.
  if (!doc) notFound();
  return {
    title: `${doc.title} — Archive`,
    description: doc.description ?? `Approved archive document: ${doc.title}.`,
  };
}

export default async function PublicArchiveDetailPage({
  params,
}: {
  params: Promise<DocumentParams>;
}) {
  const { slug } = await params;
  const doc = await loadDocument(slug);
  if (!doc) notFound();
  // Signed-in members may download directly; visitors are pointed at
  // sign-in (downloads always require an identity for the audit trail).
  const appUser = await getCurrentAppUser();

  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="Academic archive"
        title={doc.title}
        description={doc.description ?? "No description provided."}
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone="success">Approved</Badge>
        <Badge tone="neutral">{doc.categoryName}</Badge>
        {doc.year ? (
          <Badge tone="neutral">{doc.year}</Badge>
        ) : null}
        {doc.batchName ? (
          <Badge tone="neutral">{doc.batchName}</Badge>
        ) : null}
      </div>

      <div className="mt-8 flex max-w-3xl flex-col gap-6">
        <Card>
          <dl className="flex flex-col gap-3">
            {doc.abstract ? (
              <div>
                <dt className="text-sm font-medium text-zinc-500">Abstract</dt>
                <dd className="mt-1 text-sm leading-6 text-zinc-900">
                  {doc.abstract}
                </dd>
              </div>
            ) : null}
            <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-zinc-500">Author</dt>
              <dd className="text-sm text-zinc-900 sm:col-span-2">
                {doc.authorSlug ? (
                  <Link
                    href={routes.public.alumniProfile(doc.authorSlug)}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {doc.authorName ?? "View profile"}
                  </Link>
                ) : (
                  (doc.authorName ?? "A community member")
                )}
              </dd>
            </div>
            {doc.supervisorName ? (
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-zinc-500">
                  Supervisor
                </dt>
                <dd className="text-sm text-zinc-900 sm:col-span-2">
                  {doc.supervisorName}
                </dd>
              </div>
            ) : null}
            {doc.keywords && doc.keywords.length > 0 ? (
              <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-zinc-500">Keywords</dt>
                <dd className="text-sm text-zinc-900 sm:col-span-2">
                  {doc.keywords.join(", ")}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card>
          {appUser ? (
            <>
              <p className="text-sm text-zinc-600">
                Members download from the portal, where access is verified
                on every request.
              </p>
              <Link
                href={routes.portal.archive}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Open in the portal
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-600">
                Sign in to download this document. Downloads require a
                member identity so access stays auditable.
              </p>
              <Link
                href={routes.public.signIn}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Sign in to download
              </Link>
            </>
          )}
        </Card>
      </div>
    </Container>
  );
}
