import { ValidationError } from "@/lib/errors";
import { sanitizeFilename } from "@/validations/uploads";

/**
 * Server-side storage path layout. Every path is GENERATED here — user input
 * (filenames, ids from untrusted contexts) never forms a path directly, and a
 * random token per object prevents collisions and makes paths unguessable.
 * Knowing a path still grants nothing: authorization always comes from the
 * database record, never the path.
 *
 * Layout (within each bucket):
 *   documents/{documentId}/versions/{n}/{token}/{file}  (archive, immutable)
 *   staging/{requesterId}/{token}/{file}                (pre-finalize only)
 *   profiles/{userId}/{token}/{file}                    (media)
 *   stories/{storyId}/{token}/{file}
 *   achievements/{achievementId}/{token}/{file}
 *   memory/{entryId}/{token}/{file}
 */

export interface DocumentVersionPathInput {
  documentId: string;
  versionNumber: number;
  filename: string;
}

export function buildDocumentVersionPath(
  input: DocumentVersionPathInput,
): string {
  assertTrackableId(input.documentId, "documentId");
  if (!Number.isInteger(input.versionNumber) || input.versionNumber <= 0) {
    throw new ValidationError([
      { field: "versionNumber", message: "Invalid version number." },
    ]);
  }
  return [
    "documents",
    input.documentId,
    "versions",
    String(input.versionNumber),
    randomToken(),
    sanitizeFilename(input.filename),
  ].join("/");
}

export function buildStagingPath(input: {
  requesterId: string;
  filename: string;
}): string {
  assertTrackableId(input.requesterId, "requesterId");
  return [
    "staging",
    input.requesterId,
    randomToken(),
    sanitizeFilename(input.filename),
  ].join("/");
}

export function buildProfileMediaPath(input: {
  userId: string;
  filename: string;
}): string {
  assertTrackableId(input.userId, "userId");
  return ["profiles", input.userId, randomToken(), sanitizeFilename(input.filename)].join("/");
}

export function buildStoryMediaPath(input: {
  storyId: string;
  filename: string;
}): string {
  assertTrackableId(input.storyId, "storyId");
  return ["stories", input.storyId, randomToken(), sanitizeFilename(input.filename)].join("/");
}

export function buildAchievementMediaPath(input: {
  achievementId: string;
  filename: string;
}): string {
  assertTrackableId(input.achievementId, "achievementId");
  return [
    "achievements",
    input.achievementId,
    randomToken(),
    sanitizeFilename(input.filename),
  ].join("/");
}

export function buildMemoryMediaPath(input: {
  entryId: string;
  filename: string;
}): string {
  assertTrackableId(input.entryId, "entryId");
  return ["memory", input.entryId, randomToken(), sanitizeFilename(input.filename)].join("/");
}

/** True for pre-finalize objects (the orphan-reconciliation scope). */
export function isStagingPath(path: string): boolean {
  return path === "staging" || path.startsWith("staging/");
}

/**
 * Structural path guard for paths arriving from storage listings or the
 * database (never from raw user input — those are rebuilt via builders).
 * Rejects traversal, absolute paths, backslashes, and empty segments.
 */
export function assertSafePath(path: string, field = "path"): void {
  const segments = path.split("/");
  const unsafe =
    path === "" ||
    path.startsWith("/") ||
    path.includes("\\") ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    );
  if (unsafe) {
    throw new ValidationError([{ field, message: "Invalid storage path." }]);
  }
}

function assertTrackableId(value: string, field: string): void {
  if (!/^[0-9a-fA-F-]{1,64}$/.test(value) || value.includes("..")) {
    throw new ValidationError([{ field, message: "Invalid identifier." }]);
  }
}

function randomToken(): string {
  return crypto.randomUUID();
}
