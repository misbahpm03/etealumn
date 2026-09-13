import type { IsoDateString, Uuid } from "./common";
import type {
  DocumentPermissionKind,
  DocumentStatus,
  DocumentVisibility,
} from "./document";

/**
 * Academic archive entities + DTOs (Phase 9).
 *
 * `Document` mirrors the raw table (server-side only — storage paths and
 * approval internals never leave the service layer except into signed-URL
 * flows). Member search results use `DocumentSummary` (RLS-equivalent
 * fields, no storage paths); anonymous/public reads use ONLY
 * `PublicDocument` (the `documents_public` view shape).
 */

/** Raw document row (owner/staff reads through RLS; never sent to browsers whole). */
export interface Document {
  id: Uuid;
  ownerId: Uuid;
  batchId: Uuid | null;
  categoryId: Uuid;
  title: string;
  slug: string;
  description: string | null;
  abstract: string | null;
  year: number | null;
  supervisorName: string | null;
  keywords: ReadonlyArray<string> | null;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  allowDownload: boolean;
  storageProvider: string;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  submittedAt: IsoDateString | null;
  approvedAt: IsoDateString | null;
  approvedBy: Uuid | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  deletedAt: IsoDateString | null;
}

/** Immutable version row (no updates exist — inserts only). */
export interface DocumentVersion {
  id: Uuid;
  documentId: Uuid;
  versionNumber: number;
  storageProvider: string;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  changeNote: string | null;
  uploadedBy: Uuid;
  createdAt: IsoDateString;
}

/** Explicit grant (VIEW and DOWNLOAD are independent). */
export interface DocumentPermission {
  id: Uuid;
  documentId: Uuid;
  userId: Uuid;
  permission: DocumentPermissionKind;
  grantedBy: Uuid;
  createdAt: IsoDateString;
  expiresAt: IsoDateString | null;
}

/** Reference data (active categories are publicly readable). */
export interface DocumentCategory {
  id: Uuid;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
}

/** Owner-supplied creation metadata (owner/status/audit fields are server-set). */
export interface CreateDocumentInput {
  title: string;
  slug?: string | null;
  description?: string | null;
  abstract?: string | null;
  year?: number | null;
  supervisorName?: string | null;
  keywords?: ReadonlyArray<string> | null;
  visibility?: DocumentVisibility;
  allowDownload?: boolean;
  categoryId: Uuid;
  batchId?: Uuid | null;
}

/** Owner-editable metadata (lifecycle/ownership/audit fields are not editable). */
export interface UpdateDocumentInput {
  title?: string;
  slug?: string | null;
  description?: string | null;
  abstract?: string | null;
  year?: number | null;
  supervisorName?: string | null;
  keywords?: ReadonlyArray<string> | null;
  categoryId?: Uuid;
  batchId?: Uuid | null;
  allowDownload?: boolean;
}

/** Member search result (no storage paths, no approval internals). */
export interface DocumentSummary {
  id: Uuid;
  ownerId: Uuid;
  title: string;
  slug: string;
  description: string | null;
  year: number | null;
  supervisorName: string | null;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  allowDownload: boolean;
  categoryId: Uuid;
  batchId: Uuid | null;
  updatedAt: IsoDateString;
}

/** Raw member-search input (query params / form — ALWAYS validated). */
export interface DocumentSearchInput {
  text?: unknown;
  supervisor?: unknown;
  keyword?: unknown;
  categoryId?: unknown;
  batchId?: unknown;
  year?: unknown;
  visibility?: unknown;
  status?: unknown;
  ownOnly?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

/** Validated member search (applied inside the database under RLS). */
export interface DocumentSearchQuery {
  text: string | null;
  supervisor: string | null;
  keyword: string | null;
  categoryId: Uuid | null;
  batchId: Uuid | null;
  year: number | null;
  visibility: DocumentVisibility | null;
  status: DocumentStatus | null;
  ownOnly: boolean;
  limit: number;
  offset: number;
}

export interface DocumentSearchResult {
  rows: ReadonlyArray<DocumentSummary>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Public projection row (`documents_public` view — anonymous-safe). */
export interface PublicDocument {
  slug: string;
  title: string;
  description: string | null;
  abstract: string | null;
  year: number | null;
  supervisorName: string | null;
  keywords: ReadonlyArray<string> | null;
  allowDownload: boolean;
  categoryName: string;
  categorySlug: string;
  batchName: string | null;
  batchAdmissionYear: number | null;
  batchGraduationYear: number | null;
  /** NULL when the owner's profile is not publicly eligible. */
  authorName: string | null;
  authorSlug: string | null;
}

/** Raw public-search input (validated before use). */
export interface PublicDocumentSearchInput {
  text?: unknown;
  categorySlug?: unknown;
  year?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

export interface PublicDocumentSearchQuery {
  text: string | null;
  categorySlug: string | null;
  year: number | null;
  limit: number;
  offset: number;
}

export interface PublicDocumentSearchResult {
  rows: ReadonlyArray<PublicDocument>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** File access grant (signed URL + display metadata — never the path). */
export interface DocumentFileAccess {
  url: string;
  expiresAt: IsoDateString;
  filename: string;
  mimeType: string;
}
