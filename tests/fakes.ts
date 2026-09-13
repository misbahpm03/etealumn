/**
 * In-memory fakes for archive security tests (Phase 10 §22–23).
 *
 * These fakes implement the REAL repository/provider interfaces, so the
 * tests exercise the production services (including the real
 * `AcademicDocumentStorageService` orchestration) without any database.
 * They deliberately mirror database behavior where the service depends
 * on it: slug uniqueness, version-number uniqueness (ConflictError),
 * and re-grant upserts.
 *
 * What these tests prove: service-layer authorization, lifecycle rules,
 * download gating, conflict handling, and audit coverage. What they do
 * NOT prove: RLS policies and triggers — those need the live-DB matrix
 * (`tests/rls-matrix.sql`, still unverified — see the arch doc).
 */
import { ConflictError, NotFoundError } from "@/lib/errors";
import type {
  AuditLogInput,
  AuditLogRepository,
  BatchRepository,
  CreateDocumentRecord,
  DocumentCategoryRepository,
  DocumentPermissionRepository,
  DocumentRepository,
  DocumentStatusWrite,
  DocumentVersionRepository,
  GrantPermissionInput,
  ProfileRepository,
  UserRepository,
} from "@/repositories";
import {
  AcademicDocumentStorageService,
  buildDocumentVersionPath,
} from "@/services/storage";
import type {
  FileMetadata,
  MoveInput,
  StorageProvider,
  StoredFile,
  UploadInput,
} from "@/providers/storage.provider";
import type { StorageBucket } from "@/config/storage";
import type { DocumentVersionStore } from "@/services/storage";
import {
  AcademicDocumentService,
  type AcademicDocumentDeps,
} from "@/services/archive/academic-document.service";
import {
  DocumentPermissionService,
  type DocumentPermissionDeps,
} from "@/services/archive/document-permission.service";
import type {
  Batch,
  Document,
  DocumentCategory,
  DocumentPermission,
  DocumentSearchQuery,
  DocumentStatus,
  DocumentSummary,
  DocumentVersion,
  DocumentVisibility,
  PaginatedResult,
  Profile,
  SessionUser,
  UpdateDocumentInput,
  UserRole,
  UserStatus,
  Uuid,
} from "@/types";

export interface WorldState {
  docs: Map<Uuid, Document>;
  versions: DocumentVersion[];
  grants: DocumentPermission[];
  categories: Map<Uuid, DocumentCategory>;
  batches: Map<Uuid, Batch>;
  users: Map<Uuid, SessionUser>;
  profiles: Map<Uuid, Profile>;
  objects: Map<string, { data: Uint8Array; mimeType: string }>;
  audit: AuditLogInput[];
  /** createSignedDownloadUrl call count — must stay 0 on denials. */
  signedUrls: number;
  /** Scripted one-shot failure for the next version insert (conflict test). */
  failNextVersionInsert: Error | null;
  /**
   * Rival row landed by the simulated race winner before the scripted
   * failure throws — the retry must observe it via `maxVersionNumber`.
   */
  rivalVersion: {
    documentId: Uuid;
    versionNumber: number;
    uploadedBy: Uuid;
  } | null;
}

export function createWorld(): WorldState {
  return {
    docs: new Map(),
    versions: [],
    grants: [],
    categories: new Map(),
    batches: new Map(),
    users: new Map(),
    profiles: new Map(),
    objects: new Map(),
    audit: [],
    signedUrls: 0,
    failNextVersionInsert: null,
    rivalVersion: null,
  };
}

let seq = 0;
export function uuid(prefix = "00000000-0000-4000-8000-"): Uuid {
  seq += 1;
  return `${prefix}${String(seq).padStart(12, "0")}`;
}

export function makeUser(overrides?: {
  role?: UserRole;
  status?: UserStatus;
  id?: Uuid;
}): SessionUser {
  return {
    id: overrides?.id ?? uuid(),
    email: `user${seq}@example.invalid`,
    role: overrides?.role ?? "STUDENT",
    status: overrides?.status ?? "ACTIVE",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  };
}

export function makeCategory(name = "Thesis"): DocumentCategory {
  return {
    id: uuid(),
    name,
    slug: name.toLowerCase(),
    description: null,
    isActive: true,
    displayOrder: 0,
  };
}

export function makeBatch(name = "Batch 2022"): Batch {
  return {
    id: uuid(),
    name,
    batchNumber: 1,
    admissionYear: 2022,
    graduationYear: 2026,
    description: null,
    coverImagePath: null,
    status: "ACTIVE",
  };
}

export function makeProfile(userId: Uuid, fullName = "Test Member"): Profile {
  return {
    id: uuid(),
    userId,
    fullName,
    displayName: null,
    profilePhotoPath: null,
    bio: null,
    phone: null,
    location: null,
    websiteUrl: null,
    linkedinUrl: null,
    facebookUrl: null,
    githubUrl: null,
    profileSlug: null,
    profileVisibility: "PRIVATE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

export function makeDoc(overrides: {
  ownerId: Uuid;
  categoryId: Uuid;
  status?: DocumentStatus;
  visibility?: DocumentVisibility;
  allowDownload?: boolean;
  submittedAt?: string | null;
  id?: Uuid;
}): Document {
  const id = overrides.id ?? uuid();
  return {
    id,
    ownerId: overrides.ownerId,
    batchId: null,
    categoryId: overrides.categoryId,
    title: `Document ${id.slice(-4)}`,
    slug: `document-${id.slice(-4)}`,
    description: "A complete test document.",
    abstract: null,
    year: 2026,
    supervisorName: null,
    keywords: null,
    visibility: overrides.visibility ?? "PRIVATE",
    status: overrides.status ?? "DRAFT",
    allowDownload: overrides.allowDownload ?? true,
    storageProvider: "fake",
    storageBucket: "academic-archive",
    storagePath: `docs/${id}/v1/file.pdf`,
    originalFilename: "file.pdf",
    mimeType: "application/pdf",
    fileSize: 10,
    submittedAt: overrides.submittedAt ?? null,
    approvedAt: null,
    approvedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };
}

export function makeFile(name = "file.pdf"): {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  data: Uint8Array;
} {
  const data = new TextEncoder().encode("%PDF-1.4 fake");
  return { filename: name, mimeType: "application/pdf", sizeBytes: data.byteLength, data };
}

// ------------------------------------------------------------------ repos ---
export class FakeDocumentRepository implements DocumentRepository {
  constructor(private readonly state: WorldState) {}

  async findById(id: Uuid): Promise<Document | null> {
    return this.state.docs.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Document | null> {
    for (const doc of this.state.docs.values()) {
      if (doc.slug === slug) return doc;
    }
    return null;
  }

  async create(input: CreateDocumentRecord): Promise<Document> {
    for (const doc of this.state.docs.values()) {
      if (doc.slug === (input.slug ?? "")) {
        throw new ConflictError("Slug taken.");
      }
    }
    const now = new Date().toISOString();
    const doc: Document = {
      id: input.id,
      ownerId: input.ownerId,
      batchId: input.batchId ?? null,
      categoryId: input.categoryId,
      title: input.title,
      slug: input.slug ?? `doc-${input.id.slice(-6)}`,
      description: input.description ?? null,
      abstract: input.abstract ?? null,
      year: input.year ?? null,
      supervisorName: input.supervisorName ?? null,
      keywords: input.keywords ? [...input.keywords] : null,
      visibility: input.visibility ?? "PRIVATE",
      status: "DRAFT",
      allowDownload: input.allowDownload ?? false,
      storageProvider: input.storageProvider,
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.state.docs.set(doc.id, doc);
    return doc;
  }

  async updateMetadata(id: Uuid, input: UpdateDocumentInput): Promise<Document> {
    const doc = this.state.docs.get(id);
    if (!doc) throw new NotFoundError("Document");
    if (input.slug !== undefined && input.slug !== null) {
      for (const other of this.state.docs.values()) {
        if (other.id !== id && other.slug === input.slug) {
          throw new ConflictError("Slug taken.");
        }
      }
    }
    const updated: Document = {
      ...doc,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.slug !== undefined ? { slug: input.slug ?? doc.slug } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.abstract !== undefined ? { abstract: input.abstract } : {}),
      ...(input.year !== undefined ? { year: input.year } : {}),
      ...(input.supervisorName !== undefined
        ? { supervisorName: input.supervisorName }
        : {}),
      ...(input.keywords !== undefined
        ? { keywords: input.keywords ? [...input.keywords] : null }
        : {}),
      ...(input.categoryId !== undefined
        ? { categoryId: input.categoryId }
        : {}),
      ...(input.batchId !== undefined ? { batchId: input.batchId } : {}),
      ...(input.allowDownload !== undefined
        ? { allowDownload: input.allowDownload }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    this.state.docs.set(id, updated);
    return updated;
  }

  async updateStatus(id: Uuid, write: DocumentStatusWrite): Promise<Document> {
    const doc = this.state.docs.get(id);
    if (!doc) throw new NotFoundError("Document");
    const updated: Document = {
      ...doc,
      status: write.status,
      ...(write.submittedAt !== undefined
        ? { submittedAt: write.submittedAt }
        : {}),
      ...(write.approvedAt !== undefined
        ? { approvedAt: write.approvedAt }
        : {}),
      ...(write.approvedBy !== undefined
        ? { approvedBy: write.approvedBy }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    this.state.docs.set(id, updated);
    return updated;
  }

  async updateVisibility(
    id: Uuid,
    visibility: DocumentVisibility,
  ): Promise<Document> {
    const doc = this.state.docs.get(id);
    if (!doc) throw new NotFoundError("Document");
    const updated = {
      ...doc,
      visibility,
      updatedAt: new Date().toISOString(),
    };
    this.state.docs.set(id, updated);
    return updated;
  }

  async softDelete(id: Uuid): Promise<Document> {
    const doc = this.state.docs.get(id);
    if (!doc) throw new NotFoundError("Document");
    const updated = {
      ...doc,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.docs.set(id, updated);
    return updated;
  }

  async restore(id: Uuid): Promise<Document> {
    const doc = this.state.docs.get(id);
    if (!doc) throw new NotFoundError("Document");
    const updated = { ...doc, deletedAt: null };
    this.state.docs.set(id, updated);
    return updated;
  }

  async deleteDraftById(id: Uuid, ownerId: Uuid): Promise<void> {
    const doc = this.state.docs.get(id);
    if (doc && doc.ownerId === ownerId) {
      this.state.docs.delete(id);
    }
  }

  async search(
    query: DocumentSearchQuery,
    ownerId: Uuid | null,
  ): Promise<{ rows: DocumentSummary[]; total: number }> {
    let rows = [...this.state.docs.values()].filter((d) => !d.deletedAt);
    if (ownerId) rows = rows.filter((d) => d.ownerId === ownerId);
    if (query.status) rows = rows.filter((d) => d.status === query.status);
    if (query.visibility)
      rows = rows.filter((d) => d.visibility === query.visibility);
    if (query.categoryId)
      rows = rows.filter((d) => d.categoryId === query.categoryId);
    if (query.batchId) rows = rows.filter((d) => d.batchId === query.batchId);
    if (query.year !== null)
      rows = rows.filter((d) => d.year === query.year);
    const { text, supervisor, keyword } = query;
    if (text)
      rows = rows.filter((d) =>
        d.title.toLowerCase().includes(text.toLowerCase()),
      );
    if (supervisor) {
      const needle = supervisor.toLowerCase();
      rows = rows.filter((d) =>
        (d.supervisorName ?? "").toLowerCase().includes(needle),
      );
    }
    if (keyword)
      rows = rows.filter((d) => (d.keywords ?? []).includes(keyword));
    const total = rows.length;
    const page = rows.slice(query.offset, query.offset + query.limit);
    return {
      rows: page.map((d) => ({
        id: d.id,
        ownerId: d.ownerId,
        title: d.title,
        slug: d.slug,
        description: d.description,
        year: d.year,
        supervisorName: d.supervisorName,
        visibility: d.visibility,
        status: d.status,
        allowDownload: d.allowDownload,
        categoryId: d.categoryId,
        batchId: d.batchId,
        submittedAt: d.submittedAt,
        updatedAt: d.updatedAt,
      })),
      total,
    };
  }

  async maxVersionNumber(documentId: Uuid): Promise<number> {
    let max = 0;
    for (const v of this.state.versions) {
      if (v.documentId === documentId && v.versionNumber > max) {
        max = v.versionNumber;
      }
    }
    return max;
  }
}

export class FakeDocumentVersionRepository implements DocumentVersionRepository {
  constructor(private readonly state: WorldState) {}

  async listByDocument(
    documentId: Uuid,
  ): Promise<ReadonlyArray<DocumentVersion>> {
    return this.state.versions
      .filter((v) => v.documentId === documentId)
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }

  async findByDocumentAndNumber(
    documentId: Uuid,
    versionNumber: number,
  ): Promise<DocumentVersion | null> {
    return (
      this.state.versions.find(
        (v) => v.documentId === documentId && v.versionNumber === versionNumber,
      ) ?? null
    );
  }
}

export class FakeDocumentVersionStore implements DocumentVersionStore {
  constructor(private readonly state: WorldState) {}

  async createVersion(input: {
    documentId: Uuid;
    versionNumber: number;
    storageBucket: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    changeNote: string | null;
    uploadedBy: Uuid;
  }): Promise<{ versionNumber: number }> {
    if (this.state.failNextVersionInsert) {
      const error = this.state.failNextVersionInsert;
      this.state.failNextVersionInsert = null;
      const rival = this.state.rivalVersion;
      this.state.rivalVersion = null;
      if (rival) {
        this.state.versions.push({
          id: uuid(),
          documentId: rival.documentId,
          versionNumber: rival.versionNumber,
          storageProvider: "fake",
          storageBucket: input.storageBucket,
          storagePath: buildDocumentVersionPath({
            documentId: rival.documentId,
            versionNumber: rival.versionNumber,
            filename: input.originalFilename,
          }),
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          changeNote: null,
          uploadedBy: rival.uploadedBy,
          createdAt: new Date().toISOString(),
        });
      }
      throw error;
    }
    // Mirror the UNIQUE(document_id, version_number) constraint.
    const taken = this.state.versions.some(
      (v) =>
        v.documentId === input.documentId &&
        v.versionNumber === input.versionNumber,
    );
    if (taken) {
      throw new ConflictError("Version already exists.");
    }
    this.state.versions.push({
      id: uuid(),
      documentId: input.documentId,
      versionNumber: input.versionNumber,
      storageProvider: "fake",
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      changeNote: input.changeNote,
      uploadedBy: input.uploadedBy,
      createdAt: new Date().toISOString(),
    });
    return { versionNumber: input.versionNumber };
  }

  async updateDocumentFile(input: {
    documentId: Uuid;
    storageBucket: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
  }): Promise<void> {
    const doc = this.state.docs.get(input.documentId);
    if (!doc) throw new NotFoundError("Document");
    this.state.docs.set(input.documentId, {
      ...doc,
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      updatedAt: new Date().toISOString(),
    });
  }
}

export class FakeDocumentPermissionRepository
  implements DocumentPermissionRepository
{
  constructor(private readonly state: WorldState) {}

  async listByDocument(
    documentId: Uuid,
  ): Promise<ReadonlyArray<DocumentPermission>> {
    return this.state.grants.filter((g) => g.documentId === documentId);
  }

  async listByDocumentAndUser(
    documentId: Uuid,
    userId: Uuid,
  ): Promise<ReadonlyArray<DocumentPermission>> {
    return this.state.grants.filter(
      (g) => g.documentId === documentId && g.userId === userId,
    );
  }

  async grant(
    documentId: Uuid,
    input: GrantPermissionInput,
  ): Promise<DocumentPermission> {
    const existing = this.state.grants.find(
      (g) =>
        g.documentId === documentId &&
        g.userId === input.userId &&
        g.permission === input.permission,
    );
    if (existing) {
      existing.expiresAt = input.expiresAt;
      return existing;
    }
    const grant: DocumentPermission = {
      id: uuid(),
      documentId,
      userId: input.userId,
      permission: input.permission,
      grantedBy: input.grantedBy,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
    };
    this.state.grants.push(grant);
    return grant;
  }

  async revoke(
    documentId: Uuid,
    userId: Uuid,
    permission: DocumentPermission["permission"],
  ): Promise<void> {
    this.state.grants = this.state.grants.filter(
      (g) =>
        !(
          g.documentId === documentId &&
          g.userId === userId &&
          g.permission === permission
        ),
    );
  }
}

export class FakeDocumentCategoryRepository
  implements DocumentCategoryRepository
{
  constructor(private readonly state: WorldState) {}

  async findById(id: Uuid): Promise<DocumentCategory | null> {
    return this.state.categories.get(id) ?? null;
  }

  async listActive(): Promise<ReadonlyArray<DocumentCategory>> {
    return [...this.state.categories.values()].filter((c) => c.isActive);
  }
}

export class FakeBatchRepository implements BatchRepository {
  constructor(private readonly state: WorldState) {}

  async findById(id: Uuid): Promise<Batch | null> {
    return this.state.batches.get(id) ?? null;
  }

  async listAll(): Promise<ReadonlyArray<Batch>> {
    return [...this.state.batches.values()];
  }
}

export class FakeUserRepository implements UserRepository {
  constructor(private readonly state: WorldState) {}

  async findById(id: Uuid): Promise<SessionUser | null> {
    return this.state.users.get(id) ?? null;
  }

  async findByAuthUserId(authUserId: Uuid): Promise<SessionUser | null> {
    return this.state.users.get(authUserId) ?? null;
  }

  async findByEmail(email: string): Promise<SessionUser | null> {
    for (const u of this.state.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  async list(): Promise<PaginatedResult<SessionUser>> {
    throw new Error("not needed in tests");
  }

  async updateStatus(id: Uuid, status: UserStatus): Promise<SessionUser> {
    const user = this.state.users.get(id);
    if (!user) throw new NotFoundError("User");
    const updated = { ...user, status };
    this.state.users.set(id, updated);
    return updated;
  }

  async updateRole(id: Uuid, role: UserRole): Promise<SessionUser> {
    const user = this.state.users.get(id);
    if (!user) throw new NotFoundError("User");
    const updated = { ...user, role };
    this.state.users.set(id, updated);
    return updated;
  }

  async touchLastLogin(): Promise<void> {}
}

export class FakeProfileRepository implements ProfileRepository {
  constructor(private readonly state: WorldState) {}

  async findByUserId(userId: Uuid): Promise<Profile | null> {
    return this.state.profiles.get(userId) ?? null;
  }

  async findBySlug(slug: string): Promise<Profile | null> {
    for (const p of this.state.profiles.values()) {
      if (p.profileSlug === slug) return p;
    }
    return null;
  }

  async create(input: {
    userId: Uuid;
    fullName: string;
  }): Promise<Profile> {
    const profile = makeProfile(input.userId, input.fullName);
    this.state.profiles.set(input.userId, profile);
    return profile;
  }

  async update(userId: Uuid): Promise<Profile> {
    const profile = this.state.profiles.get(userId);
    if (!profile) throw new NotFoundError("Profile");
    return profile;
  }

  async setSlug(userId: Uuid, slug: string): Promise<Profile> {
    const profile = this.state.profiles.get(userId);
    if (!profile) throw new NotFoundError("Profile");
    const updated = { ...profile, profileSlug: slug };
    this.state.profiles.set(userId, updated);
    return updated;
  }
}

export class FakeAuditLogRepository implements AuditLogRepository {
  constructor(private readonly state: WorldState) {}

  async record(input: AuditLogInput): Promise<void> {
    this.state.audit.push(input);
  }
}

export class FakeStorageProvider implements StorageProvider {
  readonly name = "fake";

  constructor(private readonly state: WorldState) {}

  private key(bucket: StorageBucket, path: string): string {
    return `${bucket}:${path}`;
  }

  async upload(input: UploadInput): Promise<StoredFile> {
    if (input.makePublic === true) {
      throw new Error("archive uploads must never request public objects");
    }
    const data =
      input.data instanceof Uint8Array
        ? input.data
        : new Uint8Array(
            input.data instanceof ArrayBuffer
              ? input.data
              : await input.data.arrayBuffer(),
          );
    this.state.objects.set(this.key(input.bucket, input.path), {
      data,
      mimeType: input.mimeType,
    });
    return {
      provider: "fake",
      bucket: input.bucket,
      path: input.path,
      filename: input.path.split("/").pop() ?? "file",
      sizeBytes: data.byteLength,
      mimeType: input.mimeType,
      updatedAt: new Date().toISOString(),
      checksum: null,
    };
  }

  async replace(): Promise<StoredFile> {
    throw new Error("archive flows must never replace objects (append-only)");
  }

  async move(input: MoveInput): Promise<StoredFile> {
    const from = this.key(input.bucket, input.fromPath);
    const object = this.state.objects.get(from);
    if (!object) throw new NotFoundError("Object");
    this.state.objects.delete(from);
    this.state.objects.set(this.key(input.bucket, input.toPath), object);
    return {
      provider: "fake",
      bucket: input.bucket,
      path: input.toPath,
      filename: input.toPath.split("/").pop() ?? "file",
      sizeBytes: object.data.byteLength,
      mimeType: object.mimeType,
      updatedAt: new Date().toISOString(),
      checksum: null,
    };
  }

  async download(bucket: StorageBucket, path: string): Promise<Blob> {
    const object = this.state.objects.get(this.key(bucket, path));
    if (!object) throw new NotFoundError("Object");
    return new Blob([Uint8Array.from(object.data)], {
      type: object.mimeType,
    });
  }

  async createSignedDownloadUrl(): Promise<string> {
    this.state.signedUrls += 1;
    return `https://signed.invalid/download-${this.state.signedUrls}`;
  }

  async getMetadata(
    bucket: StorageBucket,
    path: string,
  ): Promise<FileMetadata> {
    const object = this.state.objects.get(this.key(bucket, path));
    if (!object) throw new NotFoundError("Object");
    return {
      provider: "fake",
      bucket,
      path,
      filename: path.split("/").pop() ?? "file",
      sizeBytes: object.data.byteLength,
      mimeType: object.mimeType,
      updatedAt: new Date().toISOString(),
    };
  }

  async remove(bucket: StorageBucket, path: string): Promise<void> {
    this.state.objects.delete(this.key(bucket, path));
  }

  async exists(bucket: StorageBucket, path: string): Promise<boolean> {
    return this.state.objects.has(this.key(bucket, path));
  }
}

// ------------------------------------------------------------------ wiring ---
export interface ArchiveHarness {
  state: WorldState;
  deps: AcademicDocumentDeps;
  service: (user: SessionUser) => AcademicDocumentService;
  permissions: (user: SessionUser) => DocumentPermissionService;
}

export function createHarness(): ArchiveHarness {
  const state = createWorld();
  const docs = new FakeDocumentRepository(state);
  const versions = new FakeDocumentVersionRepository(state);
  const versionStore = new FakeDocumentVersionStore(state);
  const permissions = new FakeDocumentPermissionRepository(state);
  const files = new FakeStorageProvider(state);
  const deps: AcademicDocumentDeps = {
    documents: docs,
    documentsPrivileged: docs,
    versions,
    versionStore,
    permissionsPrivileged: permissions,
    profilesPrivileged: new FakeProfileRepository(state),
    categories: new FakeDocumentCategoryRepository(state),
    batches: new FakeBatchRepository(state),
    audit: new FakeAuditLogRepository(state),
    files,
    storage: new AcademicDocumentStorageService(files, versionStore),
  };
  const permissionDepsFor = (): DocumentPermissionDeps => ({
    documents: docs,
    documentsPrivileged: docs,
    permissions,
    permissionsPrivileged: permissions,
    usersPrivileged: new FakeUserRepository(state),
    audit: new FakeAuditLogRepository(state),
  });
  return {
    state,
    deps,
    service: (user) => new AcademicDocumentService(deps, user),
    permissions: (user) => new DocumentPermissionService(permissionDepsFor(), user),
  };
}
