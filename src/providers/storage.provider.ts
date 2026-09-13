import type { StorageBucket } from "@/config/storage";

/**
 * Pointer to a stored object. Persist this metadata — never a hardcoded URL.
 * URLs are minted per access via `createSignedDownloadUrl`, which lets the
 * provider move/rotate storage without breaking the database.
 */
export interface StoredFile {
  provider: string;
  bucket: StorageBucket;
  /** Provider-native path/key within the bucket. */
  path: string;
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
 * File-storage contract. Supabase Storage is the first implementation;
 * any S3-compatible (or other) backend can replace it behind this interface.
 */
export interface StorageProvider {
  readonly name: string;
  upload(input: UploadInput): Promise<StoredFile>;
  /**
   * Mint a time-limited, authorized download URL for a private object.
   * `expiresInSeconds` defaults per provider when omitted.
   */
  createSignedDownloadUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds?: number,
  ): Promise<string>;
  remove(bucket: StorageBucket, path: string): Promise<void>;
  exists(bucket: StorageBucket, path: string): Promise<boolean>;
}
