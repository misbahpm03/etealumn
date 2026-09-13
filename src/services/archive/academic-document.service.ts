import { STORAGE_BUCKETS } from "@/config/storage";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { generateDocumentSlug } from "@/lib/slug";
import type {
  AuditLogRepository,
  BatchRepository,
  DocumentCategoryRepository,
  DocumentPermissionRepository,
  DocumentRepository,
  DocumentVersionRepository,
  ProfileRepository,
} from "@/repositories";
import type { StorageProvider } from "@/providers/storage.provider";
import {
  assertActiveUser,
  assertAnyRole,
  assertRole,
} from "@/services/auth/guards";
import {
  AcademicDocumentStorageService,
  buildDocumentVersionPath,
  type DocumentFileRecord,
  type DocumentVersionRecord,
  type DocumentVersionStore,
  type VersionUploadFile,
} from "@/services/storage";
import type { StorageBucket } from "@/config/storage";
import type {
  CreateDocumentInput,
  Document,
  DocumentFileAccess,
  DocumentPermissionKind,
  DocumentSearchQuery,
  DocumentStatus,
  DocumentVersion,
  DocumentVisibility,
  ReviewQueueItem,
  SessionUser,
  UpdateDocumentInput,
  Uuid,
} from "@/types";
import {
  isAllowedTransition,
  normalizeKeywords,
  validateChangeNote,
  validateCreateDocument,
  validateUpdateDocument,
} from "@/validations/documents";
import { validateUploadForBucket } from "@/validations/uploads";
import { validateRecordId } from "@/validations/profile";

/**
 * Wiring. Request-client repos enforce RLS self-service (reads, owner
 * draft edits); privileged repos serve the deliberate server-side seams
 * (creation with explicit id, lifecycle/visibility/storage writes, version
 * inserts, audit) — every one audited and rule-checked in this service.
 */
export interface AcademicDocumentDeps {
  documents: DocumentRepository;
  documentsPrivileged: DocumentRepository;
  versions: DocumentVersionRepository;
  versionStore: DocumentVersionStore;
  /** Privileged (server-side auth checks — never user-controlled reads). */
  permissionsPrivileged: DocumentPermissionRepository;
  /** Privileged profile reads for queue owner names (names ONLY). */
  profilesPrivileged: ProfileRepository;
  categories: DocumentCategoryRepository;
  batches: BatchRepository;
  audit: AuditLogRepository;
  /** Privileged object store (initial uploads; version flow uses `storage`). */
  files: StorageProvider;
  storage: AcademicDocumentStorageService;
}

const EDITABLE_STATUSES: ReadonlyArray<DocumentStatus> = ["DRAFT", "REJECTED"];
const STAFF_ROLES = ["MODERATOR", "ADMIN"] as const;

/** Unfiltered search (queue scoping applies status + RLS only). */
const EMPTY_SEARCH: DocumentSearchQuery = {
  text: null,
  supervisor: null,
  keyword: null,
  categoryId: null,
  batchId: null,
  year: null,
  visibility: null,
  status: null,
  ownOnly: false,
  limit: 100,
  offset: 0,
};

/**
 * Member document domain service, bound to ONE server-resolved user.
 * Ownership always derives from the bound user — no method accepts an
 * owner id. Lifecycle methods encode the transition map explicitly: the
 * browser never supplies a target status.
 */
export class AcademicDocumentService {
  constructor(
    private readonly deps: AcademicDocumentDeps,
    private readonly appUser: SessionUser,
  ) {}

  private get userId(): Uuid {
    return this.appUser.id;
  }

  // ------------------------------------------------------------ create ---
  /**
   * Create a DRAFT with its first file version: validate → upload object →
   * insert document (privileged: explicit id has no direct grant) → insert
   * version 1 → audit. Any failure compensates (row and/or object removed).
   */
  async createDocument(
    input: CreateDocumentInput,
    file: VersionUploadFile,
  ): Promise<Document> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateCreateDocument(input));
    throwIfIssues(validateUploadForBucket(file, STORAGE_BUCKETS.ACADEMIC_ARCHIVE));
    await this.assertCategoryActive(input.categoryId);
    await this.assertBatchExists(input.batchId ?? null);

    const keywords = normalizeKeywords(input.keywords);
    const baseSlug =
      input.slug ?? generateDocumentSlug(input.title);
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      // Fresh suffix per attempt: slug-taken never surfaces (no oracle).
      const slug =
        attempt === 0 ? baseSlug : `${trimSlugBase(baseSlug)}-${randomSuffix()}`;
      const id = crypto.randomUUID();
      const path = buildDocumentVersionPath({
        documentId: id,
        versionNumber: 1,
        filename: file.filename,
      });
      const bucket = STORAGE_BUCKETS.ACADEMIC_ARCHIVE;
      const uploaded = await this.deps.files.upload({
        bucket,
        path,
        data: file.data,
        mimeType: file.mimeType,
      });
      let doc: Document;
      try {
        doc = await this.deps.documentsPrivileged.create({
          ...input,
          id,
          ownerId: this.userId,
          slug,
          keywords,
          storageProvider: this.deps.files.name,
          storageBucket: bucket,
          storagePath: uploaded.path,
          originalFilename: file.filename,
          mimeType: file.mimeType,
          fileSize: uploaded.sizeBytes,
        });
      } catch (error) {
        await this.removeObjectBestEffort(bucket, uploaded.path, id);
        if (!(error instanceof ConflictError)) throw error;
        lastError = error;
        continue;
      }
      try {
        await this.deps.versionStore.createVersion({
          documentId: id,
          versionNumber: 1,
          storageBucket: bucket,
          storagePath: uploaded.path,
          originalFilename: file.filename,
          mimeType: file.mimeType,
          fileSize: uploaded.sizeBytes,
          changeNote: null,
          uploadedBy: this.userId,
        });
      } catch (error) {
        // Compensate: the draft references nothing else yet.
        await this.deleteDraftBestEffort(id);
        await this.removeObjectBestEffort(bucket, uploaded.path, id);
        throw error;
      }
      await this.deps.audit.record({
        actorId: this.userId,
        action: "document_created",
        entityType: "documents",
        entityId: id,
        metadata: { visibility: doc.visibility },
      });
      return doc;
    }
    throw lastError instanceof Error
      ? lastError
      : new ConflictError("Could not allocate a document slug.");
  }

  // -------------------------------------------------------------- read ---
  /** RLS-filtered read (null when invisible — no oracle). */
  async getDocument(id: Uuid): Promise<Document | null> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    return this.deps.documents.findById(id);
  }

  async listVersions(id: Uuid): Promise<ReadonlyArray<DocumentVersion>> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    // RLS decides readability; versions inherit the same gate.
    const doc = await this.deps.documents.findById(id);
    if (!doc) throw new NotFoundError("Document");
    return this.deps.versions.listByDocument(id);
  }

  // ------------------------------------------------------------- queue ---
  /**
   * Staff-only moderation queue: SUBMITTED + UNDER_REVIEW rows via the
   * request client (RLS scopes to review-visible rows), enriched with
   * owner display names plus category/batch names. Profile reads are
   * privileged (moderators must not depend on RLS reads of other users'
   * raw profiles) and project to names ONLY — no emails, phones, or any
   * other profile field ever enters the DTO. Oldest-submitted first so
   * the longest-waiting review tops the queue. Unpaginated by design
   * (minimal queue — revisit if review volume grows).
   */
  async listReviewQueue(): Promise<ReadonlyArray<ReviewQueueItem>> {
    assertAnyRole(this.appUser, STAFF_ROLES);
    const [submitted, inReview] = await Promise.all([
      this.deps.documents.search(
        { ...EMPTY_SEARCH, status: "SUBMITTED" },
        null,
      ),
      this.deps.documents.search(
        { ...EMPTY_SEARCH, status: "UNDER_REVIEW" },
        null,
      ),
    ]);
    const rows = [...submitted.rows, ...inReview.rows];
    const items = await Promise.all(
      rows.map(async (row) => this.toQueueItem(row)),
    );
    return items.sort((a, b) =>
      (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""),
    );
  }

  private async toQueueItem(row: {
    id: Uuid;
    title: string;
    status: DocumentStatus;
    visibility: DocumentVisibility;
    submittedAt: string | null;
    ownerId: Uuid;
    categoryId: Uuid;
    batchId: Uuid | null;
  }): Promise<ReviewQueueItem> {
    if (row.status !== "SUBMITTED" && row.status !== "UNDER_REVIEW") {
      throw new NotFoundError("Document");
    }
    const [profile, category, batch] = await Promise.all([
      this.deps.profilesPrivileged.findByUserId(row.ownerId),
      this.deps.categories.findById(row.categoryId),
      row.batchId ? this.deps.batches.findById(row.batchId) : null,
    ]);
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      visibility: row.visibility,
      submittedAt: row.submittedAt,
      ownerId: row.ownerId,
      ownerDisplayName:
        profile?.displayName ?? profile?.fullName ?? "Former member",
      categoryName: category?.name ?? "Unknown category",
      batchName: batch?.name ?? null,
    };
  }

  // ---------------------------------------------------------- download ---
  /**
   * Signed download access for the current file (or one historic
   * version). The full tree runs BEFORE any URL is minted: live row →
   * readability (unreadable reads as 404, never 403 — no oracle) →
   * download rule → global `allow_download` switch → version ownership.
   * Every grant is audited with the resolved version number.
   */
  async getDownloadAccess(
    id: Uuid,
    versionNumber?: number | null,
  ): Promise<DocumentFileAccess> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    const doc = await this.requireLivePrivileged(id);
    if (!(await this.canRead(doc))) throw new NotFoundError("Document");
    if (!(await this.canDownload(doc))) {
      throw new ForbiddenError("Downloading is disabled for this document.");
    }
    const record: DocumentFileRecord = {
      id: doc.id,
      ownerId: doc.ownerId,
      status: doc.status,
      deletedAt: doc.deletedAt,
      currentVersion: await this.deps.documents.maxVersionNumber(id),
      storageBucket: doc.storageBucket,
      storagePath: doc.storagePath,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
    };
    let version: DocumentVersionRecord | null = null;
    let resolvedVersion = record.currentVersion;
    if (versionNumber !== undefined && versionNumber !== null) {
      const row = await this.deps.versions.findByDocumentAndNumber(
        id,
        versionNumber,
      );
      if (!row || row.documentId !== id) throw new NotFoundError("Document");
      version = {
        documentId: row.documentId,
        versionNumber: row.versionNumber,
        storageBucket: row.storageBucket,
        storagePath: row.storagePath,
        originalFilename: row.originalFilename,
        mimeType: row.mimeType,
      };
      resolvedVersion = row.versionNumber;
    }
    const access = await this.deps.storage.getDownloadAccess({
      document: record,
      version,
      expiresInSeconds: 300,
    });
    await this.deps.audit.record({
      actorId: this.userId,
      action: "document_downloaded",
      entityType: "documents",
      entityId: id,
      metadata: { versionNumber: resolvedVersion },
    });
    return access;
  }

  // ------------------------------------------------------------ update ---
  /** Owner metadata edit while DRAFT/REJECTED (RLS re-enforces). */
  async updateDocument(
    id: Uuid,
    patch: UpdateDocumentInput,
  ): Promise<Document> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    throwIfIssues(validateUpdateDocument(patch));
    const doc = await this.requireOwnedLive(id);
    this.requireEditable(doc);
    if (patch.categoryId !== undefined) {
      await this.assertCategoryActive(patch.categoryId);
    }
    if (patch.batchId !== undefined) {
      await this.assertBatchExists(patch.batchId);
    }
    const keywords =
      patch.keywords !== undefined
        ? normalizeKeywords(patch.keywords)
        : undefined;
    let slug = patch.slug ?? undefined;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.deps.documents.updateMetadata(id, {
          ...patch,
          ...(keywords !== undefined ? { keywords } : {}),
          ...(slug !== undefined ? { slug } : {}),
        });
      } catch (error) {
        if (!(error instanceof ConflictError) || slug === undefined) throw error;
        lastError = error;
        slug = `${trimSlugBase(slug)}-${randomSuffix()}`;
      }
    }
    throw lastError instanceof Error ? lastError : new ConflictError("Slug taken.");
  }

  /**
   * Visibility change (no direct-SQL path by design): owner while
   * DRAFT/REJECTED, admin on any live row. Audited either way.
   */
  async updateVisibility(
    id: Uuid,
    visibility: DocumentVisibility,
  ): Promise<Document> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    const doc = await this.requireLivePrivileged(id);
    const isOwner = doc.ownerId === this.userId;
    const isAdmin = this.appUser.role === "ADMIN";
    if (isAdmin) {
      // Admins may adjust visibility on any live row.
    } else if (isOwner && (EDITABLE_STATUSES as ReadonlyArray<string>).includes(doc.status)) {
      // Owners only while the document is still theirs to shape.
    } else {
      throw new ForbiddenError("You cannot change this document's visibility.");
    }
    const updated = await this.deps.documentsPrivileged.updateVisibility(id, visibility);
    await this.deps.audit.record({
      actorId: this.userId,
      action: "document_visibility_changed",
      entityType: "documents",
      entityId: id,
      metadata: { from: doc.visibility, to: visibility },
    });
    return updated;
  }

  // ---------------------------------------------------------- lifecycle ---
  /**
   * DRAFT → SUBMITTED (owner only). Requires submittable metadata: active
   * category, year, and a description or abstract.
   */
  async submitDocument(id: Uuid): Promise<Document> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    const doc = await this.requireLivePrivileged(id);
    if (doc.ownerId !== this.userId) {
      throw new ForbiddenError("Only the owner can submit this document.");
    }
    this.requireTransition(doc, "SUBMITTED");
    const missing = await this.missingSubmissionFields(doc);
    if (missing.length > 0) {
      throw new ValidationError(
        missing.map((field) => ({
          field,
          message: "Required before submission.",
        })),
      );
    }
    const updated = await this.deps.documentsPrivileged.updateStatus(id, {
      status: "SUBMITTED",
      submittedAt: new Date().toISOString(),
    });
    await this.deps.audit.record({
      actorId: this.userId,
      action: "document_submitted",
      entityType: "documents",
      entityId: id,
      metadata: { from: "DRAFT", to: "SUBMITTED" },
    });
    return updated;
  }

  /** SUBMITTED → UNDER_REVIEW (staff only). */
  async beginReview(id: Uuid): Promise<Document> {
    assertAnyRole(this.appUser, [...STAFF_ROLES]);
    throwIfIssues(validateRecordId(id));
    const doc = await this.requireLivePrivileged(id);
    this.requireTransition(doc, "UNDER_REVIEW");
    const updated = await this.deps.documentsPrivileged.updateStatus(id, {
      status: "UNDER_REVIEW",
    });
    await this.deps.audit.record({
      actorId: this.userId,
      action: "document_review_started",
      entityType: "documents",
      entityId: id,
      metadata: { from: "SUBMITTED", to: "UNDER_REVIEW" },
    });
    return updated;
  }

  /**
   * UNDER_REVIEW → APPROVED (staff only, never self-approval).
   * Approver + timestamp are server-set; the category must still be active.
   */
  async approveDocument(id: Uuid): Promise<Document> {
    assertAnyRole(this.appUser, [...STAFF_ROLES]);
    throwIfIssues(validateRecordId(id));
    const doc = await this.requireLivePrivileged(id);
    if (doc.ownerId === this.userId) {
      throw new ForbiddenError("You cannot approve your own document.");
    }
    this.requireTransition(doc, "APPROVED");
    await this.assertCategoryActive(doc.categoryId);
    const updated = await this.deps.documentsPrivileged.updateStatus(id, {
      status: "APPROVED",
      approvedAt: new Date().toISOString(),
      approvedBy: this.userId,
    });
    await this.deps.audit.record({
      actorId: this.userId,
      action: "document_approved",
      entityType: "documents",
      entityId: id,
      metadata: { from: "UNDER_REVIEW", to: "APPROVED" },
    });
    return updated;
  }

  /**
   * UNDER_REVIEW → REJECTED (staff only). No rejection-reason field
   * exists in the schema — reasons are NOT faked (documented limitation).
   */
  async rejectDocument(id: Uuid): Promise<Document> {
    assertAnyRole(this.appUser, [...STAFF_ROLES]);
    throwIfIssues(validateRecordId(id));
    const doc = await this.requireLivePrivileged(id);
    this.requireTransition(doc, "REJECTED");
    const updated = await this.deps.documentsPrivileged.updateStatus(id, {
      status: "REJECTED",
    });
    await this.deps.audit.record({
      actorId: this.userId,
      action: "document_rejected",
      entityType: "documents",
      entityId: id,
      metadata: { from: "UNDER_REVIEW", to: "REJECTED" },
    });
    return updated;
  }

  /** APPROVED → ARCHIVED (staff only). */
  async archiveDocument(id: Uuid): Promise<Document> {
    assertAnyRole(this.appUser, [...STAFF_ROLES]);
    throwIfIssues(validateRecordId(id));
    const doc = await this.requireLivePrivileged(id);
    this.requireTransition(doc, "ARCHIVED");
    const updated = await this.deps.documentsPrivileged.updateStatus(id, {
      status: "ARCHIVED",
    });
    await this.deps.audit.record({
      actorId: this.userId,
      action: "document_archived",
      entityType: "documents",
      entityId: id,
      metadata: { from: "APPROVED", to: "ARCHIVED" },
    });
    return updated;
  }

  /** REJECTED → DRAFT (owner or staff — the revision path). */
  async reopenDocument(id: Uuid): Promise<Document> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    const doc = await this.requireLivePrivileged(id);
    const isOwner = doc.ownerId === this.userId;
    const isStaff = (STAFF_ROLES as ReadonlyArray<string>).includes(this.appUser.role);
    if (!isOwner && !isStaff) {
      throw new ForbiddenError("You cannot reopen this document.");
    }
    this.requireTransition(doc, "DRAFT");
    const updated = await this.deps.documentsPrivileged.updateStatus(id, {
      status: "DRAFT",
      submittedAt: null,
    });
    await this.deps.audit.record({
      actorId: this.userId,
      action: "document_reopened",
      entityType: "documents",
      entityId: id,
      metadata: { from: "REJECTED", to: "DRAFT" },
    });
    return updated;
  }

  // ------------------------------------------------------------ versions ---
  /**
   * Owner file replacement while DRAFT/REJECTED. Delegates bytes to the
   * Phase 5 storage service (validate → stage → move → row → pointer),
   * retrying the whole upload on version-number conflict (unique
   * constraint arbitrates; each attempt stages a fresh random path, so a
   * loser never deletes a winner's object).
   */
  async uploadVersion(
    id: Uuid,
    file: VersionUploadFile,
    changeNote?: string | null,
  ): Promise<{ document: Document; versionNumber: number }> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    throwIfIssues(validateChangeNote(changeNote ?? null));
    const doc = await this.requireOwnedLive(id);
    this.requireEditable(doc);
    let currentVersion = await this.deps.documents.maxVersionNumber(id);
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const record: DocumentFileRecord = {
          id: doc.id,
          ownerId: doc.ownerId,
          status: doc.status,
          deletedAt: doc.deletedAt,
          currentVersion,
          storageBucket: doc.storageBucket,
          storagePath: doc.storagePath,
          originalFilename: doc.originalFilename,
          mimeType: doc.mimeType,
        };
        const { versionNumber } = await this.deps.storage.uploadNewVersion({
          document: record,
          requesterId: this.userId,
          file,
          changeNote: changeNote ?? null,
        });
        await this.deps.audit.record({
          actorId: this.userId,
          action: "document_version_uploaded",
          entityType: "documents",
          entityId: id,
          metadata: { versionNumber },
        });
        const updated = await this.deps.documents.findById(id);
        if (!updated) throw new NotFoundError("Document");
        return { document: updated, versionNumber };
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
        lastError = error;
        currentVersion = await this.deps.documents.maxVersionNumber(id);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new ConflictError("Version upload conflicted. Try again.");
  }

  // ------------------------------------------------------------ delete ---
  /**
   * Soft delete: owner while DRAFT/REJECTED/SUBMITTED (withdrawal), admin
   * on any live row. Storage objects are retained (immutable history).
   */
  async softDeleteDocument(id: Uuid): Promise<Document> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    const doc = await this.requireLivePrivileged(id);
    const isOwner = doc.ownerId === this.userId;
    const isAdmin = this.appUser.role === "ADMIN";
    const ownerDeletable =
      isOwner && ["DRAFT", "REJECTED", "SUBMITTED"].includes(doc.status);
    if (!isAdmin && !ownerDeletable) {
      throw new ForbiddenError("You cannot delete this document.");
    }
    const updated = await this.deps.documentsPrivileged.softDelete(id);
    await this.deps.audit.record({
      actorId: this.userId,
      action: "document_deleted",
      entityType: "documents",
      entityId: id,
      metadata: { status: doc.status },
    });
    return updated;
  }

  /** Restore a soft-deleted document (admin only). */
  async restoreDocument(id: Uuid): Promise<Document> {
    assertRole(this.appUser, "ADMIN");
    throwIfIssues(validateRecordId(id));
    const doc = await this.deps.documentsPrivileged.findById(id);
    if (!doc || !doc.deletedAt) {
      throw new ValidationError([
        { field: "id", message: "Only deleted documents can be restored." },
      ]);
    }
    const updated = await this.deps.documentsPrivileged.restore(id);
    await this.deps.audit.record({
      actorId: this.userId,
      action: "document_restored",
      entityType: "documents",
      entityId: id,
      metadata: { status: updated.status },
    });
    return updated;
  }

  // ------------------------------------------------------------ helpers ---
  /** Request-client load + owner check (visible-but-foreign → Forbidden). */
  private async requireOwnedLive(id: Uuid): Promise<Document> {
    const doc = await this.deps.documents.findById(id);
    if (!doc || doc.deletedAt) throw new NotFoundError("Document");
    if (doc.ownerId !== this.userId) {
      throw new ForbiddenError("Only the owner can change this document.");
    }
    return doc;
  }

  /** Privileged load for transitions (staff act on rows RLS may hide). */
  private async requireLivePrivileged(id: Uuid): Promise<Document> {
    const doc = await this.deps.documentsPrivileged.findById(id);
    if (!doc || doc.deletedAt) throw new NotFoundError("Document");
    return doc;
  }

  /**
   * Readability mirror of `public.can_access_document` — RLS stays
   * authoritative (reads go through the request client); this only
   * decides 404-vs-403 on the download path without a second query.
   * Entry asserts guarantee an ACTIVE viewer, so only roles are checked.
   */
  private async canRead(doc: Document): Promise<boolean> {
    if (doc.ownerId === this.userId) return true;
    if (this.appUser.role === "ADMIN") return true;
    if (
      (doc.status === "SUBMITTED" || doc.status === "UNDER_REVIEW") &&
      this.appUser.role === "MODERATOR"
    ) {
      return true;
    }
    if (doc.status === "APPROVED" && this.inAudience(doc)) return true;
    return this.hasGrant(doc.id, null);
  }

  /**
   * Download tree. Owners (any live status) and active admins always;
   * moderators on review statuses (reviewers need the file, not just the
   * metadata); APPROVED audience rows under the global switch; explicit
   * per-user DOWNLOAD grants on any live status (co-author drafts
   * included) — the global `allow_download` switch stays authoritative
   * over grants, never the reverse.
   */
  private async canDownload(doc: Document): Promise<boolean> {
    if (doc.ownerId === this.userId) return true;
    if (this.appUser.role === "ADMIN") return true;
    if (
      (doc.status === "SUBMITTED" || doc.status === "UNDER_REVIEW") &&
      this.appUser.role === "MODERATOR"
    ) {
      return true;
    }
    if (!doc.allowDownload) return false;
    if (doc.status === "APPROVED" && this.inAudience(doc)) return true;
    return this.hasGrant(doc.id, "DOWNLOAD");
  }

  /** Visibility audience for APPROVED rows (mirrors RLS exactly). */
  private inAudience(doc: Document): boolean {
    switch (doc.visibility) {
      case "PUBLIC":
        return true;
      case "STUDENT_ONLY":
        return (
          this.appUser.role === "STUDENT" || this.appUser.role === "ALUMNI"
        );
      case "FACULTY_ONLY":
        return (
          this.appUser.role === "FACULTY" ||
          this.appUser.role === "MODERATOR" ||
          this.appUser.role === "ADMIN"
        );
      case "PRIVATE":
      default:
        return false;
    }
  }

  /** Unexpired grant check (`kind=null` accepts VIEW or DOWNLOAD). */
  private async hasGrant(
    documentId: Uuid,
    kind: DocumentPermissionKind | null,
  ): Promise<boolean> {
    const grants = await this.deps.permissionsPrivileged.listByDocumentAndUser(
      documentId,
      this.userId,
    );
    const now = Date.now();
    return grants.some(
      (grant) =>
        (kind === null || grant.permission === kind) &&
        (grant.expiresAt === null || Date.parse(grant.expiresAt) > now),
    );
  }

  private requireEditable(doc: Document): void {
    if (!(EDITABLE_STATUSES as ReadonlyArray<string>).includes(doc.status)) {
      throw new ForbiddenError(
        `Documents in ${doc.status} state cannot be edited directly.`,
      );
    }
  }

  private requireTransition(doc: Document, to: DocumentStatus): void {
    if (!isAllowedTransition(doc.status, to)) {
      throw new ValidationError([
        {
          field: "status",
          message: `Cannot move a ${doc.status} document to ${to}.`,
        },
      ]);
    }
  }

  private async missingSubmissionFields(doc: Document): Promise<string[]> {
    const missing: string[] = [];
    const category = await this.deps.categories.findById(doc.categoryId);
    if (!category || !category.isActive) missing.push("categoryId");
    if (doc.year === null) missing.push("year");
    if (!doc.description && !doc.abstract) missing.push("abstract");
    return missing;
  }

  private async assertCategoryActive(categoryId: Uuid): Promise<void> {
    const category = await this.deps.categories.findById(categoryId);
    if (!category || !category.isActive) {
      throw new ValidationError([
        { field: "categoryId", message: "Select an active category." },
      ]);
    }
  }

  private async assertBatchExists(batchId: Uuid | null | undefined): Promise<void> {
    if (batchId === undefined || batchId === null) return;
    const batch = await this.deps.batches.findById(batchId);
    if (!batch) {
      throw new ValidationError([
        { field: "batchId", message: "Selected batch no longer exists." },
      ]);
    }
  }

  private async removeObjectBestEffort(
    bucket: StorageBucket,
    path: string,
    documentId: string,
  ): Promise<void> {
    try {
      await this.deps.files.remove(bucket, path);
    } catch (error) {
      // Logged for orphan reconciliation (no credentials involved).
      console.warn("[archive] orphan cleanup failed", { documentId, path, error });
    }
  }

  private async deleteDraftBestEffort(documentId: string): Promise<void> {
    try {
      await this.deps.documentsPrivileged.deleteDraftById(documentId, this.userId);
    } catch (error) {
      console.warn("[archive] draft compensation failed", { documentId, error });
    }
  }
}

function throwIfIssues(
  issues: ReadonlyArray<{ field: string; message: string }>,
): void {
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}

function trimSlugBase(slug: string): string {
  return slug.slice(0, 100).replace(/-+$/g, "") || "document";
}

function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (const byte of bytes) {
    suffix += alphabet[byte % alphabet.length];
  }
  return suffix;
}
