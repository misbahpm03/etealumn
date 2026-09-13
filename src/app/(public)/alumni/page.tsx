import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  DirectorySearchForm,
  type DirectoryFilters,
} from "@/features/directory/search-form";
import { Pagination } from "@/features/directory/pagination";
import { ProfileCard } from "@/features/directory/profile-card";
import {
  createPublicBatchService,
  createPublicDirectoryService,
} from "@/infrastructure/supabase/server-session";
import { ValidationError } from "@/lib/errors";
import { routes } from "@/lib/routes";

/**
 * Caching: correctness over speed. Directory rows flip visibility the
 * moment a member changes settings — no static cache may serve stale
 * membership to anonymous users. Every read is live (force-dynamic).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Alumni" };

interface AlumniSearchParams {
  q?: string;
  batch?: string;
  year?: string;
  company?: string;
  designation?: string;
  location?: string;
  role?: string;
  page?: string;
}

export default async function AlumniPage({
  searchParams,
}: {
  searchParams: Promise<AlumniSearchParams>;
}) {
  const params = await searchParams;
  const directory = await createPublicDirectoryService();
  const batches = await createPublicBatchService();

  // Role defaults to ALUMNI (this is the alumni directory); visitors may
  // explicitly widen to students/faculty — the views gate every row either way.
  const filters: DirectoryFilters = {
    text: params.q,
    batchId: params.batch,
    graduationYear: params.year,
    company: params.company,
    designation: params.designation,
    location: params.location,
    role: params.role === undefined ? "ALUMNI" : params.role,
  };

  const [batchList, result] = await Promise.all([
    batches.listPublicBatches(),
    directory.searchPublicProfiles({
      text: params.q,
      batchId: params.batch,
      graduationYear: params.year,
      company: params.company,
      designation: params.designation,
      location: params.location,
      role: filters.role,
      page: params.page,
    }).catch((error: unknown) => {
      // Invalid filters (bad year, malformed batch id, deep page) read as
      // an inline message — never a 500, and never a widened query.
      if (error instanceof ValidationError) return { issues: error.issues };
      throw error;
    }),
  ]);

  const buildHref = (page: number): string => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.batch) query.set("batch", params.batch);
    if (params.year) query.set("year", params.year);
    if (params.company) query.set("company", params.company);
    if (params.designation) query.set("designation", params.designation);
    if (params.location) query.set("location", params.location);
    if (filters.role) query.set("role", filters.role);
    query.set("page", String(page));
    return `${routes.public.alumni}?${query.toString()}`;
  };

  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="Community"
        title="Alumni"
        description="Graduates of the department, shown according to their privacy settings."
      />
      <div className="mt-8">
        <DirectorySearchForm batches={batchList} current={filters} />
      </div>
      <div className="mt-8" aria-live="polite">
        {"issues" in result ? (
          <EmptyState
            title="Those filters need attention"
            description={result.issues.map((issue) => issue.message).join(" ")}
          />
        ) : result.total === 0 ? (
          <EmptyState
            title="No public profiles match"
            description="Try widening the search — members appear here only when they have made their profile public."
          />
        ) : (
          <>
            <p className="text-sm text-zinc-500">
              {result.total} {result.total === 1 ? "member" : "members"} found
            </p>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {result.rows.map((profile) => (
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
      </div>
    </Container>
  );
}
