import type {
  PostgrestError,
  SupabaseClient,
} from "@supabase/supabase-js";
import type {
  CreateDocumentRecord,
  DocumentCategoryRepository,
  DocumentPermissionRepository,
  DocumentRepository,
  DocumentStatusWrite,
  DocumentVersionRepository,
  GrantPermissionInput,
} from "@/repositories/document.repository";
import type { DocumentVersionStore } from "@/services/storage";
import type {
  Document,
  DocumentCategory,
  DocumentPermission,
  DocumentPermissionKind,
  DocumentSearchQuery,
  DocumentStatus,
  DocumentSummary,
  DocumentVersion,
  DocumentVisibility,
  UpdateDocumentInput,
  Uuid,
} from "@/types";
import { NotFoundError } from "@/lib/errors";
import { toAppError, unwrapQuery } from "./errors";

const DOCUMENT_COLUMNS =
  "id,owner_id,batch_id,category_id,title,slug,description,abstract,year,supervisor_name,keywords,visibility,status,allow_download,storage_provider,storage_bucket,storage_path,original_filename,mime_type,file_size,submitted_at,approved_at,approved_by,created_at,updated_at,deleted_at" as const;

const SUMMARY_COLUMNS =
  "id,owner_id,title,slug,description,year,supervisor_name,visibility,status,allow_download,category_id,batch_id,updated_at" as const;

const VERSION_COLUMNS =
  "id,document_id,version_number,storage_provider,storage_bucket,storage_path,original_filename,mime_type,file_size,change_note,uploaded_by,created_at" as const;

const PERMISSION_COLUMNS =
  "id,document_id,user_id,permission,granted_by,created_at,expires_at" as const;

const CATEGORY_COLUMNS =
  "id,name,slug,description,is_active,display_order" as const;

interface DocumentRow {
  id: string;
  owner_id: string;
  batch_id: string | null;
  category_id: string;
  title: string;
  slug: string;
  description: string | null;
  abstract: string | null;
  year: number | null;
  supervisor_name: string | null;
  keywords: string[] | null;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  allow_download: boolean;
  storage_provider: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface SummaryRow {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string | null;
  year: number | null;
  supervisor_name: string | null;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  allow_download: boolean;
  category_id: string;
  batch_id: string | null;
  updated_at: string;
}

interface VersionRow {
  id: string;
  document_id: string;
  version_number: number;
  storage_provider: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  change_note: string | null;
  uploaded_by: string;
  created_at: string;
}

interface PermissionRow {
  id: string;
  document_id: string;
  user_id: string;
  permission: DocumentPermissionKind;
  granted_by: string;
  created_at: string;
  expires_at: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

function toDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    ownerId: row.owner_id,
    batchId: row.batch_id,
    categoryId: row.category_id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    abstract: row.abstract,
    year: row.year,
    supervisorName: row.supervisor_name,
    keywords: row.keywords,
    visibility: row.visibility,
    status: row.status,
    allowDownload: row.allow_download,
    storageProvider: row.storage_provider,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toSummary(row: SummaryRow): DocumentSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    year: row.year,
    supervisorName: row.supervisor_name,
    visibility: row.visibility,
    status: row.status,
    allowDownload: row.allow_download,
    categoryId: row.category_id,
    batchId: row.batch_id,
    updatedAt: row.updated_at,
  };
}

function toVersion(row: VersionRow): DocumentVersion {
  return {
    id: row.id,
    documentId: row.document_id,
    versionNumber: row.version_number,
    storageProvider: row.storage_provider,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    changeNote: row.change_note,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

function toPermission(row: PermissionRow): DocumentPermission {
  return {
    id: row.id,
    documentId: row.document_id,
    userId: row.user_id,
    permission: row.permission,
    grantedBy: row.granted_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function toCategory(row: CategoryRow): DocumentCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.is_active,
    displayOrder: row.display_order,
  };
}

function toDocumentDb(input: UpdateDocumentInput): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (input.title !== undefined) db.title = input.title;
  if (input.slug !== undefined) db.slug = input.slug;
  if (input.description !== undefined) db.description = input.description;
  if (input.abstract !== undefined) db.abstract = input.abstract;
  if (input.year !== undefined) db.year = input.year;
  if (input.supervisorName !== undefined) db.supervisor_name = input.supervisorName;
  if (input.keywords !== undefined) db.keywords = input.keywords;
  if (input.categoryId !== undefined) db.category_id = input.categoryId;
  if (input.batchId !== undefined) db.batch_id = input.batchId;
  if (input.allowDownload !== undefined) db.allow_download = input.allowDownload;
  return db;
}

/** Escape LIKE metacharacters; values stay parameterized. */
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

export class SupabaseDocumentRepository implements DocumentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: Uuid): Promise<Document | null> {
    const row = (await unwrapQuery(
      this.client
        .from("documents")
        .select(DOCUMENT_COLUMNS)
        .eq("id", id)
        .maybeSingle(),
    )) as DocumentRow | null;
    return row ? toDocument(row) : null;
  }

  async findBySlug(slug: string): Promise<Document | null> {
    const row = (await unwrapQuery(
      this.client
        .from("documents")
        .select(DOCUMENT_COLUMNS)
        .eq("slug", slug)
        .is("deleted_at", null)
        .maybeSingle(),
    )) as DocumentRow | null;
    return row ? toDocument(row) : null;
  }

  async create(input: CreateDocumentRecord): Promise<Document> {
    const row = (await unwrapQuery(
      this.client
        .from("documents")
        .insert({
          id: input.id,
          owner_id: input.ownerId,
          batch_id: input.batchId ?? null,
          category_id: input.categoryId,
          title: input.title,
          slug: input.slug ?? null,
          description: input.description ?? null,
          abstract: input.abstract ?? null,
          year: input.year ?? null,
          supervisor_name: input.supervisorName ?? null,
          keywords: input.keywords ?? null,
          visibility: input.visibility ?? "PRIVATE",
          // status intentionally omitted: DRAFT default + no direct grant.
          allow_download: input.allowDownload ?? false,
          storage_provider: input.storageProvider,
          storage_bucket: input.storageBucket,
          storage_path: input.storagePath,
          original_filename: input.originalFilename,
          mime_type: input.mimeType,
          file_size: input.fileSize,
        })
        .select(DOCUMENT_COLUMNS)
        .single(),
    )) as DocumentRow;
    return toDocument(row);
  }

  async updateMetadata(id: Uuid, input: UpdateDocumentInput): Promise<Document> {
    const db = toDocumentDb(input);
    if (Object.keys(db).length === 0) {
      const current = await this.findById(id);
      if (!current) throw new NotFoundError("Document");
      return current;
    }
    const row = (await unwrapQuery(
      this.client
        .from("documents")
        .update(db)
        .eq("id", id)
        .select(DOCUMENT_COLUMNS)
        .maybeSingle(),
    )) as DocumentRow | null;
    if (!row) throw new NotFoundError("Document");
    return toDocument(row);
  }

  async updateStatus(id: Uuid, write: DocumentStatusWrite): Promise<Document> {
    const db: Record<string, unknown> = { status: write.status };
    if (write.submittedAt !== undefined) db.submitted_at = write.submittedAt;
    if (write.approvedAt !== undefined) db.approved_at = write.approvedAt;
    if (write.approvedBy !== undefined) db.approved_by = write.approvedBy;
    const row = (await unwrapQuery(
      this.client
        .from("documents")
        .update(db)
        .eq("id", id)
        .select(DOCUMENT_COLUMNS)
        .maybeSingle(),
    )) as DocumentRow | null;
    if (!row) throw new NotFoundError("Document");
    return toDocument(row);
  }

  async updateVisibility(
    id: Uuid,
    visibility: DocumentVisibility,
  ): Promise<Document> {
    const row = (await unwrapQuery(
      this.client
        .from("documents")
        .update({ visibility })
        .eq("id", id)
        .select(DOCUMENT_COLUMNS)
        .maybeSingle(),
    )) as DocumentRow | null;
    if (!row) throw new NotFoundError("Document");
    return toDocument(row);
  }

  async softDelete(id: Uuid): Promise<Document> {
    const row = (await unwrapQuery(
      this.client
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select(DOCUMENT_COLUMNS)
        .maybeSingle(),
    )) as DocumentRow | null;
    if (!row) throw new NotFoundError("Document");
    return toDocument(row);
  }

  async restore(id: Uuid): Promise<Document> {
    const row = (await unwrapQuery(
      this.client
        .from("documents")
        .update({ deleted_at: null })
        .eq("id", id)
        .select(DOCUMENT_COLUMNS)
        .maybeSingle(),
    )) as DocumentRow | null;
    if (!row) throw new NotFoundError("Document");
    return toDocument(row);
  }

  async deleteDraftById(id: Uuid, ownerId: Uuid): Promise<void> {
    const row = (await unwrapQuery(
      this.client
        .from("documents")
        .select("id,owner_id,status,deleted_at")
        .eq("id", id)
        .maybeSingle(),
    )) as { id: string; owner_id: string; status: string; deleted_at: string | null } | null;
    if (
      !row ||
      row.owner_id !== ownerId ||
      row.status !== "DRAFT" ||
      row.deleted_at !== null
    ) {
      throw new NotFoundError("Document");
    }
    await unwrapQuery(
      this.client.from("documents").delete().eq("id", id),
    );
  }

  async search(
    query: DocumentSearchQuery,
    ownerId: Uuid | null,
  ): Promise<{ rows: DocumentSummary[]; total: number }> {
    let builder = this.client
      .from("documents")
      .select(SUMMARY_COLUMNS, { count: "exact" });
    // Every filter applies INSIDE the database; RLS `can_access_document`
    // constrains candidates before any row returns. Column names are
    // constants; values are service-validated + parameterized.
    if (query.text !== null) {
      builder = builder.ilike("title", `%${escapeLikeLiteral(query.text)}%`);
    }
    if (query.supervisor !== null) {
      builder = builder.ilike(
        "supervisor_name",
        `%${escapeLikeLiteral(query.supervisor)}%`,
      );
    }
    if (query.keyword !== null) {
      builder = builder.overlaps("keywords", [query.keyword]);
    }
    if (query.categoryId !== null) {
      builder = builder.eq("category_id", query.categoryId);
    }
    if (query.batchId !== null) {
      builder = builder.eq("batch_id", query.batchId);
    }
    if (query.year !== null) {
      builder = builder.eq("year", query.year);
    }
    if (query.visibility !== null) {
      builder = builder.eq("visibility", query.visibility);
    }
    if (query.status !== null) {
      builder = builder.eq("status", query.status);
    }
    if (query.ownOnly && ownerId) {
      builder = builder.eq("owner_id", ownerId);
    }
    const { rows, total } = await unwrapCounted(
      builder
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(query.offset, query.offset + query.limit - 1),
    );
    return { rows: (rows as SummaryRow[]).map(toSummary), total };
  }

  async maxVersionNumber(documentId: Uuid): Promise<number> {
    const rows = (await unwrapQuery(
      this.client
        .from("document_versions")
        .select("version_number")
        .eq("document_id", documentId)
        .order("version_number", { ascending: false })
        .limit(1),
    )) as Array<{ version_number: number }>;
    return rows.length > 0 ? rows[0].version_number : 0;
  }
}

export class SupabaseDocumentVersionRepository
  implements DocumentVersionRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async listByDocument(
    documentId: Uuid,
  ): Promise<ReadonlyArray<DocumentVersion>> {
    const rows = (await unwrapQuery(
      this.client
        .from("document_versions")
        .select(VERSION_COLUMNS)
        .eq("document_id", documentId)
        .order("version_number", { ascending: true }),
    )) as VersionRow[];
    return rows.map(toVersion);
  }

  async findByDocumentAndNumber(
    documentId: Uuid,
    versionNumber: number,
  ): Promise<DocumentVersion | null> {
    const row = (await unwrapQuery(
      this.client
        .from("document_versions")
        .select(VERSION_COLUMNS)
        .eq("document_id", documentId)
        .eq("version_number", versionNumber)
        .maybeSingle(),
    )) as VersionRow | null;
    return row ? toVersion(row) : null;
  }
}

export class SupabaseDocumentPermissionRepository
  implements DocumentPermissionRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async listByDocument(
    documentId: Uuid,
  ): Promise<ReadonlyArray<DocumentPermission>> {
    const rows = (await unwrapQuery(
      this.client
        .from("document_permissions")
        .select(PERMISSION_COLUMNS)
        .eq("document_id", documentId)
        .order("created_at", { ascending: true }),
    )) as PermissionRow[];
    return rows.map(toPermission);
  }

  async listByDocumentAndUser(
    documentId: Uuid,
    userId: Uuid,
  ): Promise<ReadonlyArray<DocumentPermission>> {
    const rows = (await unwrapQuery(
      this.client
        .from("document_permissions")
        .select(PERMISSION_COLUMNS)
        .eq("document_id", documentId)
        .eq("user_id", userId),
    )) as PermissionRow[];
    return rows.map(toPermission);
  }

  async grant(
    documentId: Uuid,
    input: GrantPermissionInput,
  ): Promise<DocumentPermission> {
    const row = (await unwrapQuery(
      this.client
        .from("document_permissions")
        .upsert(
          {
            document_id: documentId,
            user_id: input.userId,
            permission: input.permission,
            granted_by: input.grantedBy,
            expires_at: input.expiresAt,
          },
          { onConflict: "document_id,user_id,permission" },
        )
        .select(PERMISSION_COLUMNS)
        .single(),
    )) as PermissionRow;
    return toPermission(row);
  }

  async revoke(
    documentId: Uuid,
    userId: Uuid,
    permission: DocumentPermissionKind,
  ): Promise<void> {
    await unwrapQuery(
      this.client
        .from("document_permissions")
        .delete()
        .eq("document_id", documentId)
        .eq("user_id", userId)
        .eq("permission", permission),
    );
  }
}

export class SupabaseDocumentCategoryRepository
  implements DocumentCategoryRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: Uuid): Promise<DocumentCategory | null> {
    const row = (await unwrapQuery(
      this.client
        .from("document_categories")
        .select(CATEGORY_COLUMNS)
        .eq("id", id)
        .maybeSingle(),
    )) as CategoryRow | null;
    return row ? toCategory(row) : null;
  }

  async listActive(): Promise<ReadonlyArray<DocumentCategory>> {
    const rows = (await unwrapQuery(
      this.client
        .from("document_categories")
        .select(CATEGORY_COLUMNS)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),
    )) as CategoryRow[];
    return rows.map(toCategory);
  }
}

/**
 * Privileged `DocumentVersionStore` port implementation (Phase 5 seam).
 * No INSERT/UPDATE grants exist for API roles, so this instance MUST be
 * constructed with the privileged client. Version numbers arrive from the
 * storage service (loaded current + 1); the UNIQUE(document_id,
 * version_number) constraint arbitrates races — on ConflictError the
 * archive service reloads and retries the whole upload.
 */
export class SupabaseDocumentVersionStore implements DocumentVersionStore {
  constructor(private readonly client: SupabaseClient) {}

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
    const row = (await unwrapQuery(
      this.client
        .from("document_versions")
        .insert({
          document_id: input.documentId,
          version_number: input.versionNumber,
          storage_provider: "supabase",
          storage_bucket: input.storageBucket,
          storage_path: input.storagePath,
          original_filename: input.originalFilename,
          mime_type: input.mimeType,
          file_size: input.fileSize,
          change_note: input.changeNote,
          uploaded_by: input.uploadedBy,
        })
        .select("version_number")
        .single(),
    )) as { version_number: number };
    return { versionNumber: row.version_number };
  }

  async updateDocumentFile(input: {
    documentId: Uuid;
    storageBucket: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
  }): Promise<void> {
    await unwrapQuery(
      this.client
        .from("documents")
        .update({
          storage_provider: "supabase",
          storage_bucket: input.storageBucket,
          storage_path: input.storagePath,
          original_filename: input.originalFilename,
          mime_type: input.mimeType,
          file_size: input.fileSize,
        })
        .eq("id", input.documentId),
    );
  }
}
