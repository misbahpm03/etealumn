import { NotFoundError, ValidationError } from "@/lib/errors";
import type {
  DocumentRepository,
  PublicDocumentRepository,
} from "@/repositories";
import { assertActiveUser } from "@/services/auth/guards";
import type {
  DocumentSearchResult,
  DocumentSummary,
  PublicDocument,
  PublicDocumentSearchResult,
  SessionUser,
} from "@/types";
import type {
  DocumentSearchInput,
  PublicDocumentSearchInput,
} from "@/types";
import {
  isValidDocumentSlug,
  validateDocumentSearch,
  validatePublicDocumentSearch,
} from "@/validations/documents";

/**
 * Wiring. `documents` is the authenticated request client (RLS applies the
 * audience, lifecycle, and ownership scopes inside the database) and
 * `publicDocuments` reads only the `documents_public` projection. Neither
 * decides access alone: the member tier re-checks every row against the
 * visibility tree below, so a scope or RLS misconfiguration still cannot
 * surface protected content.
 */
export interface DocumentSearchDeps {
  documents: DocumentRepository;
  publicDocuments: PublicDocumentRepository;
}

/**
 * Auth-constrained discovery. Keyword caps and page bounds live in the
 * validations layer; lifecycle and download authorization live in
 * [`AcademicDocumentService`](./academic-document.service.ts) — this
 * service only validates input, derives ownership scope, and filters the
 * repository's candidate rows through the member-side visibility tree.
 */
export class DocumentSearchService {
  constructor(
    private readonly deps: DocumentSearchDeps,
    private readonly appUser: SessionUser | null,
  ) {}

  /**
   * Member search. Requires an authenticated caller — anonymous discovery
   * goes through `searchPublic`. `ownOnly` scopes by the caller's
   * server-side id; there is deliberately no way to scope by anyone else.
   */
  async searchMember(
    rawInput: DocumentSearchInput,
  ): Promise<DocumentSearchResult> {
    if (!this.appUser) {
      throw new ValidationError([
        { field: "session", message: "Sign in to search member documents." },
      ]);
    }
    assertActiveUser(this.appUser);
    const { query, issues } = validateDocumentSearch(rawInput);
    throwIfIssues(issues);
    const { rows, total } = await this.deps.documents.search(
      query,
      query.ownOnly ? this.appUser.id : null,
    );
    const viewer = this.appUser;
    const visible = rows.filter((row) => this.canViewMember(row, viewer));
    return {
      rows: visible,
      total,
      page: pageOf(query),
      pageSize: query.limit,
      totalPages: totalPagesOf(query, total),
    };
  }

  /**
   * Anonymous-safe public search. Rows come from the projection, which
   * only holds APPROVED + PUBLIC documents by view construction — the
   * DTO carries no owner ids, storage paths, review history, or approval
   * metadata, so no field can leak on this path.
   */
  async searchPublic(
    rawInput: PublicDocumentSearchInput,
  ): Promise<PublicDocumentSearchResult> {
    const { query, issues } = validatePublicDocumentSearch(rawInput);
    throwIfIssues(issues);
    const { rows, total } = await this.deps.publicDocuments.search(query);
    return {
      rows,
      total,
      page: pageOf(query),
      pageSize: query.limit,
      totalPages: totalPagesOf(query, total),
    };
  }

  /** Public detail row for `/archive/[slug]` (404 when absent). */
  async getPublicBySlug(slug: string): Promise<PublicDocument> {
    if (!isValidDocumentSlug(slug)) {
      throw new ValidationError([
        { field: "slug", message: "Select a valid document." },
      ]);
    }
    const doc = await this.deps.publicDocuments.getBySlug(slug);
    if (!doc) throw new NotFoundError("Document");
    return doc;
  }

  /**
   * Member-side visibility tree — mirrors `public.can_access_document`
   * exactly (RLS applies first; this only backstops a misconfiguration).
   * STUDENT_ONLY reaches students AND alumni; FACULTY_ONLY reaches
   * faculty, moderators, and admins; review statuses reach moderators
   * and admins only.
   */
  private canViewMember(row: DocumentSummary, viewer: SessionUser): boolean {
    if (row.ownerId === viewer.id) return true;
    if (viewer.role === "ADMIN" && viewer.status === "ACTIVE") return true;
    if (
      viewer.role === "MODERATOR" &&
      viewer.status === "ACTIVE" &&
      (row.status === "SUBMITTED" || row.status === "UNDER_REVIEW")
    ) {
      return true;
    }
    if (row.status !== "APPROVED") return false;
    switch (row.visibility) {
      case "PUBLIC":
        return true;
      case "STUDENT_ONLY":
        return viewer.role === "STUDENT" || viewer.role === "ALUMNI";
      case "FACULTY_ONLY":
        return (
          viewer.role === "FACULTY" ||
          viewer.role === "MODERATOR" ||
          viewer.role === "ADMIN"
        );
      case "PRIVATE":
      default:
        return false;
    }
  }
}

function pageOf(query: { limit: number; offset: number }): number {
  return Math.floor(query.offset / query.limit) + 1;
}

function totalPagesOf(
  query: { limit: number },
  total: number,
): number {
  return Math.max(1, Math.ceil(total / query.limit));
}

function throwIfIssues(
  issues: ReadonlyArray<{ field: string; message: string }>,
): void {
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}
