import { STORAGE_BUCKETS, STORAGE_LIMITS, type StorageBucket } from "@/config/storage";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import type { StorageProvider, StoredFile } from "@/providers/storage.provider";
import type { IsoDateString, Uuid } from "@/types";
import {
  validateUploadForBucket,
  type UploadFileClaim,
} from "@/validations/uploads";
import {
  assertSafePath,
  buildAchievementMediaPath,
  buildMemoryMediaPath,
  buildProfileMediaPath,
  buildStoryMediaPath,
} from "./paths";

/**
 * TRUST BOUNDARY (same as the document service). Release flags below
 * (`isVisibleToRequester`, `isPublished`, `isStaff`) are established by the
 * SERVER-SIDE caller via RLS-gated reads immediately before calling; the
 * service enforces the decision. Never accept these flags from browser input.
 */

export interface MediaFile extends UploadFileClaim {
  data: Blob | ArrayBuffer | Uint8Array;
}

/** Logical media reference (what the database stores). */
export interface MediaRef {
  bucket: StorageBucket;
  path: string;
}

export interface MediaAccess extends MediaRef {
  /** Short-lived signed URL. Never persisted — mint per request. */
  url: string;
  expiresAt: IsoDateString;
}

export interface OwnerUploadRequest {
  ownerId: Uuid;
  requesterId: Uuid;
  file: MediaFile;
}

export interface OwnerMediaAccessRequest extends MediaRef {
  ownerId: Uuid;
  requesterId: Uuid;
  expiresInSeconds?: number;
}

/**
 * Server-side media operations across the four media buckets. Media objects
 * are unversioned (a re-upload mints a fresh path; the caller swaps the
 * database pointer and removes the old object), and delivery always follows
 * an authorization decision — drafts are never publicly reachable.
 */
export class MediaStorageService {
  /**
   * @param storage Privileged provider (service-role backed). Server-only:
   * construct inside server actions/handlers, never in browser code.
   */
  constructor(private readonly storage: StorageProvider) {}

  // ------------------------------------------------------- profile media ---
  async uploadProfileMedia(request: OwnerUploadRequest): Promise<StoredFile> {
    this.assertOwner(request.ownerId, request.requesterId, "profile photo");
    return this.uploadMedia(
      STORAGE_BUCKETS.PROFILE_MEDIA,
      buildProfileMediaPath({ userId: request.ownerId, filename: request.file.filename }),
      request.file,
    );
  }

  /** Remove a superseded object (called AFTER the database pointer moves). */
  async removeMedia(request: OwnerMediaAccessRequest): Promise<void> {
    this.assertOwner(request.ownerId, request.requesterId, "media file");
    assertSafePath(request.path);
    await this.storage.remove(request.bucket, request.path);
  }

  async getProfileMediaAccess(
    request: OwnerMediaAccessRequest & { isVisibleToRequester: boolean },
  ): Promise<MediaAccess> {
    if (
      request.ownerId !== request.requesterId &&
      !request.isVisibleToRequester
    ) {
      throw new ForbiddenError("This profile photo is not visible to you.");
    }
    return this.signMedia(request);
  }

  // --------------------------------------------------------- story media ---
  async uploadStoryMedia(
    request: OwnerUploadRequest & { storyId: Uuid },
  ): Promise<StoredFile> {
    this.assertOwner(request.ownerId, request.requesterId, "story media");
    return this.uploadMedia(
      STORAGE_BUCKETS.STORY_MEDIA,
      buildStoryMediaPath({ storyId: request.storyId, filename: request.file.filename }),
      request.file,
    );
  }

  async getStoryMediaAccess(
    request: OwnerMediaAccessRequest & { isPublished: boolean },
  ): Promise<MediaAccess> {
    if (request.ownerId !== request.requesterId && !request.isPublished) {
      throw new ForbiddenError("This story is not published yet.");
    }
    return this.signMedia(request);
  }

  // --------------------------------------------------- achievement media ---
  async uploadAchievementMedia(
    request: OwnerUploadRequest & { achievementId: Uuid },
  ): Promise<StoredFile> {
    this.assertOwner(request.ownerId, request.requesterId, "achievement media");
    return this.uploadMedia(
      STORAGE_BUCKETS.ACHIEVEMENT_MEDIA,
      buildAchievementMediaPath({
        achievementId: request.achievementId,
        filename: request.file.filename,
      }),
      request.file,
    );
  }

  async getAchievementMediaAccess(
    request: OwnerMediaAccessRequest & { isPublished: boolean },
  ): Promise<MediaAccess> {
    if (request.ownerId !== request.requesterId && !request.isPublished) {
      throw new ForbiddenError("This achievement is not published yet.");
    }
    return this.signMedia(request);
  }

  // ------------------------------------------------------ memory media ---
  async uploadMemoryMedia(request: {
    entryId: Uuid;
    requesterId: Uuid;
    /** Verified staff status (server-side, via users table). */
    isStaff: boolean;
    file: MediaFile;
  }): Promise<StoredFile> {
    if (!request.isStaff) {
      throw new ForbiddenError("Only staff can manage department memory media.");
    }
    return this.uploadMedia(
      STORAGE_BUCKETS.DEPARTMENT_MEMORY_MEDIA,
      buildMemoryMediaPath({ entryId: request.entryId, filename: request.file.filename }),
      request.file,
    );
  }

  async getMemoryMediaAccess(
    request: MediaRef & {
      requesterId: Uuid;
      isPublished: boolean;
      /** Verified staff status (server-side, via users table). */
      isStaff: boolean;
      expiresInSeconds?: number;
    },
  ): Promise<MediaAccess> {
    if (!request.isStaff && !request.isPublished) {
      throw new ForbiddenError("This memory entry is not published yet.");
    }
    return this.signMedia(request);
  }

  // -------------------------------------------------------------- shared ---
  private assertOwner(ownerId: Uuid, requesterId: Uuid, what: string): void {
    if (ownerId !== requesterId) {
      throw new ForbiddenError(`Only the owner can manage this ${what}.`);
    }
  }

  private async uploadMedia(
    bucket: StorageBucket,
    path: string,
    file: MediaFile,
  ): Promise<StoredFile> {
    const issues = validateUploadForBucket(file, bucket);
    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
    return this.storage.upload({
      bucket,
      path,
      data: file.data,
      mimeType: file.mimeType,
    });
  }

  private async signMedia(
    request: MediaRef & { expiresInSeconds?: number },
  ): Promise<MediaAccess> {
    assertSafePath(request.path);
    const expiresIn =
      request.expiresInSeconds ??
      STORAGE_LIMITS.downloadSignedUrlExpiresInSeconds;
    const url = await this.storage.createSignedDownloadUrl(
      request.bucket,
      request.path,
      expiresIn,
    );
    return {
      bucket: request.bucket,
      path: request.path,
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }
}
