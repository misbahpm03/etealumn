import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { createPublicBatchService } from "@/infrastructure/supabase/server-session";
import { ValidationError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { isUuid } from "@/validations/common";
import type { BatchMemberResult } from "@/types";
import { Pagination } from "@/features/directory/pagination";
import { ProfileCard } from "@/features/directory/profile-card";

/** Force-dynamic: membership must always reflect live privacy settings. */
export const dynamic = "force-dynamic";

interface BatchParams {
  id: string;
}

async function loadBatch(
  id: string,
  page: string | undefined,
): Promise<BatchMemberResult | null> {
  // Fail fast on malformed ids without touching infrastructure (the
  // service re-validates regardless — this is only a cheap route gate).
  if (!isUuid(id)) return null;
  try {
    const batches = await createPublicBatchService();
    return await batches.listPublicBatchMembers(id, { page });
  } catch (error) {
    // Malformed ids/pages read as not-found (no oracle, no 500).
    if (error instanceof ValidationError) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<BatchParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await loadBatch(id, undefined);
  // 404 here (not just a fallback title) so the status engages before the
  // page shell streams; the page-level notFound() below is the backstop.
  if (!result) notFound();
  return { title: `${result.batch.name} — Batches` };
}

export default async function BatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<BatchParams>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page } = await searchParams;
  const result = await loadBatch(id, page);
  if (!result) notFound();

  const { batch, members, total } = result;
  const years = [batch.admissionYear, batch.graduationYear]
    .filter((part) => part !== null)
    .join(" – ");
  const buildHref = (target: number): string =>
    `${routes.public.batchDetail(batch.id)}?page=${target}`;

  return (
    <Container className="py-10">
      <Link
        href={routes.public.batches}
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none"
      >
        ← All batches
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900">{batch.name}</h1>
      {years !== "" && <p className="mt-1 text-sm text-zinc-500">{years}</p>}
      {batch.description && (
        <p className="mt-3 max-w-3xl text-sm whitespace-pre-line text-zinc-700">
          {batch.description}
        </p>
      )}

      <h2 className="mt-10 text-lg font-semibold text-zinc-900">
        Public members{total > 0 ? ` (${total})` : ""}
      </h2>
      {total === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No public members yet"
            description="Members of this batch appear here once they make their profile public."
          />
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {members.map((profile) => (
              <li key={profile.slug}>
                <ProfileCard profile={profile} />
              </li>
            ))}
          </ul>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            buildHref={buildHref}
          />
        </>
      )}
    </Container>
  );
}
