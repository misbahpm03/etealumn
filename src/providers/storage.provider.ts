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

/**
 * File-storage contract. Supabase Storage is the first implementation
 * (see `src/infrastructure/supabase/supabase-storage.provider.ts`); any
 * S3-compatible (or other) backend can replace it behind this interface.
 */
export interface StorageProvider {
  readonly name: string;
  /** Upload a new object. Fails if the path already exists. */
  upload(input: UploadInput): Promise<StoredFile>;
  /**
   * Upload, overwriting any object already stored at the path. Prefer this
   * over remove+upload so replacements stay atomic from the caller's view.
   */
  replace(input: UploadInput): Promise<StoredFile>;
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
