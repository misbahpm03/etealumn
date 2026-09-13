import type {
  CreateDocumentInput,
  Document,
  DocumentCategory,
  DocumentPermission,
  DocumentPermissionKind,
  DocumentSearchQuery,
  DocumentStatus,
  DocumentSummary,
  DocumentVersion,
  DocumentVisibility,
  PublicDocument,
  PublicDocumentSearchQuery,
  UpdateDocumentInput,
  Uuid,
} from "@/types";

/**
 * Persistence contracts for the academic archive (Phase 9 — real schema).
 *
 * Client scope is a deliberate per-method choice, mirroring the RLS grants:
 * - Request client (RLS): metadata reads, RLS-shaped search, owner
 *   draft/rejected metadata edits. RLS independently enforces audience,
 *   lifecycle, and ownership on every call.
 * - Privileged (service role, server-only): creation with explicit id,
 *   status/visibility/storage-field writes, soft delete/restore, version
 *   inserts, permission grants/revokes — all audited service operations
 *   with no direct-SQL path by design.
 */

/** Full document creation payload (service-resolved owner + file metadata). */
export interface CreateDocumentRecord extends CreateDocumentInput {
  id: Uuid;
  ownerId: Uuid;
  storageProvider: string;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}

/** Server-controlled lifecycle write (never browser-shaped). */
export interface DocumentStatusWrite {
  status: DocumentStatus;
  submittedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: Uuid | null;
}

export interface DocumentRepository {
  /** RLS-filtered read (null when invisible — no oracle). */
  findById(id: Uuid): Promise<Document | null>;
  /** RLS-filtered slug read (null when invisible — no oracle). */
  findBySlug(slug: string): Promise<Document | null>;
  /**
   * Privileged insert (explicit id for the upload-first flow; no direct
   * id-setting grant exists). The service forces owner/status/audit shape.
   * Throws ConflictError on slug collision (service retries suffixed).
   */
  create(input: CreateDocumentRecord): Promise<Document>;
  /**
   * Request-client metadata edit (RLS: owner + DRAFT/REJECTED + live).
   * Throws NotFoundError when missing/invisible, ConflictError on slug
   * collision.
   */
  updateMetadata(id: Uuid, input: UpdateDocumentInput): Promise<Document>;
  /** Privileged lifecycle write (audited service transitions only). */
  updateStatus(id: Uuid, write: DocumentStatusWrite): Promise<Document>;
  /** Privileged visibility write (no direct-SQL path by design). */
  updateVisibility(id: Uuid, visibility: DocumentVisibility): Promise<Document>;
  /** Privileged soft delete (sets deleted_at). */
  softDelete(id: Uuid): Promise<Document>;
  /** Privileged restore (clears deleted_at; admin only). */
  restore(id: Uuid): Promise<Document>;
  /**
   * Privileged compensation delete for failed creations: re-verifies the
   * row is a live DRAFT owned by `ownerId` before deleting (defense in
   * depth even on the privileged path). Throws NotFoundError otherwise.
   */
  deleteDraftById(id: Uuid, ownerId: Uuid): Promise<void>;
  /**
   * RLS-shaped member search: filters apply inside the database and
   * `can_access_document()` constrains candidates before any row returns.
   * `ownerId` scopes `ownOnly` (null for anonymous — the service rejects
   * anonymous ownOnly before calling).
   */
  search(
    query: DocumentSearchQuery,
    ownerId: Uuid | null,
  ): Promise<{ rows: DocumentSummary[]; total: number }>;
  /** Latest version number for a document (0 when none exist). */
  maxVersionNumber(documentId: Uuid): Promise<number>;
}

export interface DocumentVersionRepository {
  listByDocument(documentId: Uuid): Promise<ReadonlyArray<DocumentVersion>>;
  findByDocumentAndNumber(
    documentId: Uuid,
    versionNumber: number,
  ): Promise<DocumentVersion | null>;
}

export interface GrantPermissionInput {
  userId: Uuid;
  permission: DocumentPermissionKind;
  grantedBy: Uuid;
  expiresAt: string | null;
}

export interface DocumentPermissionRepository {
  /** Grants on a document (RLS: owner/admin/recipient-scoped reads). */
  listByDocument(documentId: Uuid): Promise<ReadonlyArray<DocumentPermission>>;
  /** One recipient's grants on a document (request-client decision input). */
  listByDocumentAndUser(
    documentId: Uuid,
    userId: Uuid,
  ): Promise<ReadonlyArray<DocumentPermission>>;
  /** Privileged grant (no direct-SQL path; upserts expiry on re-grant). */
  grant(documentId: Uuid, input: GrantPermissionInput): Promise<DocumentPermission>;
  /** Privileged revoke (idempotent — absent grants are a no-op success). */
  revoke(
    documentId: Uuid,
    userId: Uuid,
    permission: DocumentPermissionKind,
  ): Promise<void>;
}

export interface DocumentCategoryRepository {
  findById(id: Uuid): Promise<DocumentCategory | null>;
  listActive(): Promise<ReadonlyArray<DocumentCategory>>;
}

/**
 * Read-only contract over the `documents_public` safe projection — the only
 * sanctioned anonymous archive reads. Eligibility + author privacy are
 * enforced INSIDE the view.
 */
export interface PublicDocumentRepository {
  getBySlug(slug: string): Promise<PublicDocument | null>;
  search(
    query: PublicDocumentSearchQuery,
  ): Promise<{ rows: PublicDocument[]; total: number }>;
}
