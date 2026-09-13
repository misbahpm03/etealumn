import { STORAGE_BUCKETS, STORAGE_LIMITS, type StorageBucket } from "@/config/storage";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import type { StorageProvider, StoredFile } from "@/providers/storage.provider";
import type { DocumentStatus, IsoDateString, Uuid } from "@/types";
import {
  validateUploadForBucket,
  type UploadFileClaim,
} from "@/validations/uploads";
import {
  assertSafePath,
  buildDocumentVersionPath,
  buildStagingPath,
} from "./paths";

/**
 * TRUST BOUNDARY. These services run server-side and receive records that the
 * CALLER loaded through that requester's authorization context (RLS decides
 * visibility: invisible records arrive as null). The service never mints
 * access for a null record, and additionally enforces ownership, lifecycle,
 * and integrity rules below. Callers must be server actions/route handlers —
 * never browser code, which cannot be trusted to load records honestly.
 */

/** Document file pointer as loaded by the caller (RLS-filtered). */
export interface DocumentFileRecord {
  id: Uuid;
  ownerId: Uuid;
  status: DocumentStatus;
  deletedAt: IsoDateString | null;
  currentVersion: number;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
}

/** Version file pointer as loaded by the caller (RLS-filtered). */
export interface DocumentVersionRecord {
  documentId: Uuid;
  versionNumber: number;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
}

/**
 * Narrow database port for version persistence. Implemented alongside the
 * archive repositories in a later phase (Supabase implementation then):
 * `createVersion` must allocate the version number atomically (unique
 * constraint on (document_id, version_number) is the final arbiter — on
 * conflict the caller reloads the document and retries the upload).
 */
export interface DocumentVersionStore {
  createVersion(input: {
    documentId: Uuid;
    storageBucket: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    changeNote: string | null;
    uploadedBy: Uuid;
  }): Promise<{ versionNumber: number }>;
  updateDocumentFile(input: {
    documentId: Uuid;
    storageBucket: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
  }): Promise<void>;
}

export interface VersionUploadFile extends UploadFileClaim {
  data: Blob | ArrayBuffer | Uint8Array;
}

export interface UploadNewVersionRequest {
  document: DocumentFileRecord | null;
  requesterId: Uuid;
  file: VersionUploadFile;
  changeNote?: string | null;
}

export interface VersionUploadResult {
  versionNumber: number;
  file: StoredFile;
}

export interface DownloadAccessRequest {
  /** Current-file record (RLS-loaded). Null = invisible → NotFound. */
  document: DocumentFileRecord | null;
  /** Version record for history downloads (RLS-loaded); null = current file. */
  version?: DocumentVersionRecord | null;
  expiresInSeconds?: number;
}

export interface DownloadAccess {
  /** Short-lived signed URL. Never persisted — mint per request. */
  url: string;
  expiresAt: IsoDateString;
  filename: string;
  mimeType: string;
}

/** Owner-direct uploads allowed only in these lifecycle states (mirrors RLS). */
const EDITABLE_STATUSES: ReadonlyArray<DocumentStatus> = ["DRAFT", "REJECTED"];

/**
 * Server-side document file operations. Owns path generation, validation,
 * version-append flows, and signed download minting. Archive objects are
 * IMMUTABLE: replacement always appends a new version; this service never
 * calls `replace`, never deletes version objects, and exposes no delete for
 * soft-deleted documents (their files stay stored but unreachable).
 */
export class AcademicDocumentStorageService {
  /**
   * @param storage Privileged provider (service-role backed). Server-only:
   * construct inside server actions/handlers, never in browser code.
   * @param versions Database port for version rows + file-pointer updates.
   */
  constructor(
    private readonly storage: StorageProvider,
    private readonly versions: DocumentVersionStore,
  ) {}

  /**
   * Append a new immutable version: validate → stage → move to version path
   * → insert version row → advance document pointer. Each step cleans up
   * exactly what is still unreferenced on failure (see orphan strategy in
   * docs/storage.md); leftovers are covered by reconciliation, never by
   * deleting possibly-referenced objects.
   */
  async uploadNewVersion(
    request: UploadNewVersionRequest,
  ): Promise<VersionUploadResult> {
    const doc = request.document;
    if (!doc || doc.deletedAt !== null) {
      throw new NotFoundError("Document");
    }
    if (doc.ownerId !== request.requesterId) {
      throw new ForbiddenError("Only the document owner can upload a new version.");
    }
    if (!EDITABLE_STATUSES.includes(doc.status)) {
      throw new ForbiddenError(
        `Documents in ${doc.status} state cannot receive new versions directly.`,
      );
    }
    const issues = validateUploadForBucket(
      request.file,
      STORAGE_BUCKETS.ACADEMIC_ARCHIVE,
    );
    if (issues.length > 0) {
      throw new ValidationError(issues);
    }

    const bucket = STORAGE_BUCKETS.ACADEMIC_ARCHIVE;
    const staged = await this.storage.upload({
      bucket,
      path: buildStagingPath({
        requesterId: request.requesterId,
        filename: request.file.filename,
      }),
      data: request.file.data,
      mimeType: request.file.mimeType,
    });

    let moved: StoredFile;
    try {
      moved = await this.storage.move({
        bucket,
        fromPath: staged.path,
        toPath: buildDocumentVersionPath({
          documentId: doc.id,
          versionNumber: doc.currentVersion + 1,
          filename: request.file.filename,
        }),
      });
    } catch (error) {
      // Move failed: only the staging object exists → safe to remove.
      await this.removeBestEffort(bucket, staged.path);
      throw error;
    }

    let versionNumber: number;
    try {
      ({ versionNumber } = await this.versions.createVersion({
        documentId: doc.id,
        storageBucket: bucket,
        storagePath: moved.path,
        originalFilename: request.file.filename,
        mimeType: request.file.mimeType,
        fileSize: moved.sizeBytes,
        changeNote: request.changeNote ?? null,
        uploadedBy: request.requesterId,
      }));
    } catch (error) {
      // No rows reference the moved object yet → safe to remove.
      await this.removeBestEffort(bucket, moved.path);
      throw error;
    }

    // Pointer update is last: if it fails, the version row already references
    // the object, so NOTHING is deleted — retrying the pointer update is the
    // recovery, and the version stays readable as history either way.
    await this.versions.updateDocumentFile({
      documentId: doc.id,
      storageBucket: bucket,
      storagePath: moved.path,
      originalFilename: request.file.filename,
      mimeType: request.file.mimeType,
      fileSize: moved.sizeBytes,
    });
    return { versionNumber, file: moved };
  }

  /**
   * Mint short-lived download access for the current file (or one historic
   * version). The signed URL is created ONLY after the caller proved
   * visibility by loading the record — a null record yields NotFound (no
   * existence oracle), never a URL.
   */
  async getDownloadAccess(
    request: DownloadAccessRequest,
  ): Promise<DownloadAccess> {
    const doc = request.document;
    if (!doc || doc.deletedAt !== null) {
      throw new NotFoundError("Document");
    }
    let bucket = doc.storageBucket;
    let path = doc.storagePath;
    let filename = doc.originalFilename;
    let mimeType = doc.mimeType;
    if (request.version) {
      if (request.version.documentId !== doc.id) {
        throw new ForbiddenError("Version does not belong to this document.");
      }
      bucket = request.version.storageBucket;
      path = request.version.storagePath;
      filename = request.version.originalFilename;
      mimeType = request.version.mimeType;
    }
    assertSafePath(path);
    const expiresIn =
      request.expiresInSeconds ??
      STORAGE_LIMITS.downloadSignedUrlExpiresInSeconds;
    const url = await this.storage.createSignedDownloadUrl(
      assertKnownBucket(bucket),
      path,
      expiresIn,
    );
    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      filename,
      mimeType,
    };
  }

  private async removeBestEffort(
    bucket: StorageBucket,
    path: string,
  ): Promise<void> {
    try {
      await this.storage.remove(bucket, path);
    } catch {
      // Leftovers are found by orphan reconciliation; never fail the
      // original error because cleanup failed.
    }
  }
}

/** Defense against corrupted rows pointing outside known buckets. */
function assertKnownBucket(bucket: string): StorageBucket {
  const known: ReadonlyArray<string> = Object.values(STORAGE_BUCKETS);
  if (!known.includes(bucket)) {
    throw new ValidationError([
      { field: "storageBucket", message: "Unknown storage bucket." },
    ]);
  }
  return bucket as StorageBucket;
}
