import type {
  PostgrestError,
  SupabaseClient,
} from "@supabase/supabase-js";
import type { PublicDocumentRepository } from "@/repositories/document.repository";
import type {
  PublicDocument,
  PublicDocumentSearchQuery,
} from "@/types";
import { toAppError, unwrapQuery } from "./errors";

/**
 * Explicit view columns — never `*`. The view itself contains no ids,
 * storage metadata, or approval internals (Phase 9 migration).
 */
const PUBLIC_COLUMNS =
  "slug,title,description,abstract,year,supervisor_name,keywords,allow_download,category_name,category_slug,batch_name,batch_admission_year,batch_graduation_year,author_name,author_slug" as const;

interface PublicRow {
  slug: string;
  title: string;
  description: string | null;
  abstract: string | null;
  year: number | null;
  supervisor_name: string | null;
  keywords: string[] | null;
  allow_download: boolean;
  category_name: string;
  category_slug: string;
  batch_name: string | null;
  batch_admission_year: number | null;
  batch_graduation_year: number | null;
  author_name: string | null;
  author_slug: string | null;
}

function toPublicDocument(row: PublicRow): PublicDocument {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    abstract: row.abstract,
    year: row.year,
    supervisorName: row.supervisor_name,
    keywords: row.keywords,
    allowDownload: row.allow_download,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    batchName: row.batch_name,
    batchAdmissionYear: row.batch_admission_year,
    batchGraduationYear: row.batch_graduation_year,
    authorName: row.author_name,
    authorSlug: row.author_slug,
  };
}

function escapeLikeLiteral(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

async function unwrapCounted<T>(
  query: PromiseLike<{ data: T; count: number | null; error: PostgrestError | null }>,
): Promise<{ rows: T; total: number }> {
  const result = await query;
  if (result.error) throw toAppError(result.error);
  return { rows: result.data, total: result.count ?? 0 };
}

export class SupabasePublicDocumentRepository
  implements PublicDocumentRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async getBySlug(slug: string): Promise<PublicDocument | null> {
    const row = (await unwrapQuery(
      this.client
        .from("documents_public")
        .select(PUBLIC_COLUMNS)
        .eq("slug", slug)
        .maybeSingle(),
    )) as PublicRow | null;
    return row ? toPublicDocument(row) : null;
  }

  async search(
    query: PublicDocumentSearchQuery,
  ): Promise<{ rows: PublicDocument[]; total: number }> {
    let builder = this.client
      .from("documents_public")
      .select(PUBLIC_COLUMNS, { count: "exact" });
    if (query.text !== null) {
      builder = builder.ilike("title", `%${escapeLikeLiteral(query.text)}%`);
    }
    if (query.categorySlug !== null) {
      builder = builder.eq("category_slug", query.categorySlug);
    }
    if (query.year !== null) {
      builder = builder.eq("year", query.year);
    }
    const { rows, total } = await unwrapCounted(
      builder
        .order("title", { ascending: true })
        .order("slug", { ascending: true })
        .range(query.offset, query.offset + query.limit - 1),
    );
    return { rows: (rows as PublicRow[]).map(toPublicDocument), total };
  }
}
