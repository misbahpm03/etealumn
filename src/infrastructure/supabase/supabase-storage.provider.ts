import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_LIMITS, type StorageBucket } from "@/config/storage";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type {
  FileMetadata,
  MoveInput,
  StorageProvider,
  StoredFile,
  UploadInput,
} from "@/providers/storage.provider";
import { toAppError } from "./errors";

/**
 * Supabase Storage implementation of `StorageProvider`. Receives its client
 * via constructor injection so callers control auth scope (anon/request user
 * vs. privileged server operations).
 *
 * Logical buckets map 1:1 to physical Supabase buckets for now; if the
 * naming ever diverges, only `toPhysicalBucket` changes — application code
 * and stored records keep using logical names.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase";

  constructor(private readonly client: SupabaseClient) {}

  async upload(input: UploadInput): Promise<StoredFile> {
    return this.upsert(input, false);
  }

  async replace(input: UploadInput): Promise<StoredFile> {
    return this.upsert(input, true);
  }

  async move(input: MoveInput): Promise<StoredFile> {
    const { error } = await this.client.storage
      .from(this.toPhysicalBucket(input.bucket))
      .move(input.fromPath, input.toPath);
    if (error) {
      throw toAppError(error, "File finalize failed.");
    }
    // Re-stat the destination: proves the move landed and yields metadata.
    const meta = await this.getMetadata(input.bucket, input.toPath);
    if (meta.sizeBytes === null || meta.mimeType === null) {
      throw toAppError(
        { code: "move_verification_failed" },
        "File finalize failed.",
      );
    }
    return {
      provider: this.name,
      bucket: input.bucket,
      path: meta.path,
      filename: meta.filename,
      sizeBytes: meta.sizeBytes,
      mimeType: meta.mimeType,
      updatedAt: meta.updatedAt,
      checksum: null,
    };
  }

  async download(bucket: StorageBucket, path: string): Promise<Blob> {
    const { data, error } = await this.client.storage
      .from(this.toPhysicalBucket(bucket))
      .download(path);
    if (error) {
      throw toAppError(error, "File download failed.");
    }
    if (!data) {
      throw new NotFoundError("File");
    }
    return data;
  }

  async createSignedDownloadUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds?: number,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.toPhysicalBucket(bucket))
      .createSignedUrl(
        path,
        expiresInSeconds ?? STORAGE_LIMITS.defaultSignedUrlExpiresInSeconds,
      );
    if (error) {
      throw toAppError(error, "Could not create a download link.");
    }
    if (!data?.signedUrl) {
      throw toAppError(
        { code: "signed_url_missing" },
        "Could not create a download link.",
      );
    }
    return data.signedUrl;
  }

  async getMetadata(bucket: StorageBucket, path: string): Promise<FileMetadata> {
    const match = await this.findObject(bucket, path);
    if (match) {
      return {
        provider: this.name,
        bucket,
        path,
        filename: match.name,
        sizeBytes: readMetadataNumber(match.metadata, "size"),
        mimeType: readMetadataString(match.metadata, "mimetype"),
        updatedAt:
          typeof match.updated_at === "string" ? match.updated_at : null,
      };
    }
    throw new NotFoundError("File");
  }

  async remove(bucket: StorageBucket, path: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.toPhysicalBucket(bucket))
      .remove([path]);
    if (error) {
      throw toAppError(error, "File deletion failed.");
    }
  }

  async exists(bucket: StorageBucket, path: string): Promise<boolean> {
    return (await this.findObject(bucket, path)) !== null;
  }

  private toPhysicalBucket(bucket: StorageBucket): string {
    return bucket;
  }

  private async upsert(
    input: UploadInput,
    upsert: boolean,
  ): Promise<StoredFile> {
    if (input.makePublic) {
      throw new ValidationError([
        {
          field: "makePublic",
          message: "Public uploads are not supported. Private files must use signed URLs.",
        },
      ]);
    }
    const { data, error } = await this.client.storage
      .from(this.toPhysicalBucket(input.bucket))
      .upload(input.path, input.data, {
        contentType: input.mimeType,
        upsert,
      });
    if (error) {
      throw toAppError(error, "File upload failed.");
    }
    return {
      provider: this.name,
      bucket: input.bucket,
      path: data.path,
      filename: basename(input.path),
      sizeBytes: byteLength(input.data),
      mimeType: input.mimeType,
      updatedAt: null,
      checksum: null,
    };
  }

  /**
   * Supabase Storage exposes no head-object call through the JS client, so
   * existence/metadata checks list the parent folder and match by name.
   */
  private async findObject(bucket: StorageBucket, path: string) {
    const separator = path.lastIndexOf("/");
    const folder = separator >= 0 ? path.slice(0, separator) : undefined;
    const filename = separator >= 0 ? path.slice(separator + 1) : path;
    const { data, error } = await this.client.storage
      .from(this.toPhysicalBucket(bucket))
      .list(folder, { search: filename });
    if (error) {
      throw toAppError(error, "File lookup failed.");
    }
    return (data ?? []).find((entry) => entry.name === filename) ?? null;
  }
}

function basename(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator >= 0 ? path.slice(separator + 1) : path;
}

function byteLength(data: Blob | ArrayBuffer | Uint8Array): number {
  if (data instanceof Blob) {
    return data.size;
  }
  return data.byteLength;
}

function readMetadataNumber(metadata: unknown, key: string): number | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function readMetadataString(metadata: unknown, key: string): string | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}
