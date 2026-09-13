import type { StorageBucket } from "@/config/storage";
import type { IsoDateString } from "@/types";

/**
 * Logical reference to a stored object. Application code and the database
 * work with these references — never with hardcoded provider URLs. Download
 * URLs are minted per access via `createSignedDownloadUrl`, so the provider
 * can move or rotate storage without breaking stored records.
 */
export interface FileMetadata {
  provider: string;
  bucket: StorageBucket;
  /** Provider-native path/key within the bucket. */
  path: string;
  filename: string;
  sizeBytes: number | null;
  mimeType: string | null;
  updatedAt: IsoDateString | null;
}

/** Metadata returned after a successful upload. */
export interface StoredFile extends FileMetadata {
  sizeBytes: number;
  mimeType: string;
  /** Content hash when the provider supplies one (integrity checks). */
  checksum: string | null;
}

export interface UploadInput {
  bucket: StorageBucket;
  /** Desired path/key; providers may normalize or scope it per tenant. */
  path: string;
  data: Blob | ArrayBuffer | Uint8Array;
  mimeType: string;
  /** When false (default), the object must not be publicly reachable. */
  makePublic?: boolean;
}

export interface MoveInput {
  bucket: StorageBucket;
  fromPath: string;
  toPath: string;
}

/**
 * File-storage contract. Supabase Storage is the first implementation
 * (see `src/infrastructure/supabase/supabase-storage.provider.ts`); any
 * S3-compatible (or other) backend can replace it behind this interface.
 *
 * Deliberately no `copy`: the finalize flow needs same-location rename
 * (`move`), and versioning is append-only — nothing ever duplicates bytes.
 */
export interface StorageProvider {
  readonly name: string;
  /** Upload a new object. Fails if the path already exists. */
  upload(input: UploadInput): Promise<StoredFile>;
  /**
   * Upload, overwriting any object already stored at the path. Used ONLY for
   * unversioned media (e.g. profile photos) — archive files are immutable
   * and must never be replaced in place; see the document storage service.
   */
  replace(input: UploadInput): Promise<StoredFile>;
  /**
   * Rename an object within the SAME bucket (staging → final during the
   * finalize step). Cross-bucket moves are not supported — staging areas
   * live inside the destination bucket for exactly this reason.
   */
  move(input: MoveInput): Promise<StoredFile>;
  /** Download an object's bytes (caller must already be authorized). */
  download(bucket: StorageBucket, path: string): Promise<Blob>;
  /**
   * Mint a time-limited, authorized download URL for a private object.
   * `expiresInSeconds` defaults per provider when omitted.
   */
  createSignedDownloadUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds?: number,
  ): Promise<string>;
  /** Look up an object's metadata without downloading it. */
  getMetadata(bucket: StorageBucket, path: string): Promise<FileMetadata>;
  remove(bucket: StorageBucket, path: string): Promise<void>;
  exists(bucket: StorageBucket, path: string): Promise<boolean>;
}
