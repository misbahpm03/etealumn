import { ValidationError } from "@/lib/errors";
import type {
  BatchRepository,
  PublicProfileRepository,
} from "@/repositories";
import type {
  Batch,
  BatchMemberResult,
  DirectorySearchInput,
  PublicBatch,
} from "@/types";
import { validateRecordId } from "@/validations/profile";
import { validateDirectorySearch } from "@/validations/directory";

/**
 * Public batch foundation. Batch metadata is intentionally public reference
 * data (existing `batches_select_public` policy); membership ALWAYS comes
 * from the safe public projection, so private/inactive users can never leak
 * through a batch page. Batch administration stays admin-only (no writes).
 */
export class PublicBatchService {
  constructor(
    private readonly batches: BatchRepository,
    private readonly directory: PublicProfileRepository,
  ) {}

  /** All batches, projected to the public-safe subset. */
  async listPublicBatches(): Promise<ReadonlyArray<PublicBatch>> {
    const rows = await this.batches.listAll();
    return rows.map(toPublicBatch);
  }

  /** One batch's public metadata, or null. */
  async getPublicBatch(id: string): Promise<PublicBatch | null> {
    const issues = validateRecordId(id);
    if (issues.length > 0) throw new ValidationError(issues);
    const batch = await this.batches.findById(id);
    return batch ? toPublicBatch(batch) : null;
  }

  /**
   * Batch page data: metadata + paged PUBLIC members. Member pagination
   * reuses the directory search validator (same page/pageSize/offset rules)
   * with the batch pinned server-side — callers cannot widen the query.
   */
  async listPublicBatchMembers(
    id: string,
    input: DirectorySearchInput,
  ): Promise<BatchMemberResult | null> {
    const issues = validateRecordId(id);
    if (issues.length > 0) throw new ValidationError(issues);
    const batch = await this.batches.findById(id);
    if (!batch) return null;
    const { query, issues: searchIssues } = validateDirectorySearch({
      ...input,
      batchId: id,
    });
    if (searchIssues.length > 0) throw new ValidationError(searchIssues);
    const { rows, total } =
      await this.directory.searchPublicProfiles(query);
    const page = Math.floor(query.offset / query.limit) + 1;
    return {
      batch: toPublicBatch(batch),
      members: rows,
      total,
      page,
      pageSize: query.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }
}

/** Drop everything the public batch contract excludes (storage paths). */
function toPublicBatch(batch: Batch): PublicBatch {
  return {
    id: batch.id,
    name: batch.name,
    batchNumber: batch.batchNumber,
    admissionYear: batch.admissionYear,
    graduationYear: batch.graduationYear,
    description: batch.description,
    status: batch.status,
  };
}
