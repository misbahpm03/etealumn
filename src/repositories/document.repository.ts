import type {
  DocumentStatus,
  DocumentType,
  DocumentVisibility,
  IsoDateString,
  PaginatedResult,
  PaginationParams,
  Uuid,
} from "@/types";

/**
 * Minimal document shape for Phase 1. Full metadata (batch, category,
 * supervisor, abstract, keywords, versions, permissions, …) arrives with
 * the Phase 2 schema.
 */
export interface ArchiveDocument {
  id: Uuid;
  ownerId: Uuid;
  title: string;
  documentType: DocumentType;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  currentVersion: number;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface ListDocumentsFilter extends PaginationParams {
  visibility?: DocumentVisibility;
  status?: DocumentStatus;
  ownerId?: Uuid;
}

/** Persistence contract for academic archive documents. */
export interface DocumentRepository {
  findById(id: Uuid): Promise<ArchiveDocument | null>;
  list(filter: ListDocumentsFilter): Promise<PaginatedResult<ArchiveDocument>>;
  updateStatus(id: Uuid, status: DocumentStatus): Promise<ArchiveDocument>;
  updateVisibility(
    id: Uuid,
    visibility: DocumentVisibility,
  ): Promise<ArchiveDocument>;
}
