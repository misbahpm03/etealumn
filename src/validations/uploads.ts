import {
  EXPECTED_MIME_TYPES,
  STORAGE_VALIDATION,
  type BucketValidationRules,
  type StorageBucket,
} from "@/config/storage";
import type { ValidationIssue } from "./common";

export interface UploadFileClaim {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

const MAX_FILENAME_LENGTH = 100;
const MIN_FILE_SIZE_BYTES = 1;

/** Lowercase extension without the dot, or "" when there is none. */
export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) {
    return "";
  }
  return filename.slice(dot + 1).toLowerCase();
}

/**
 * Reduce a user-supplied filename to a safe single path segment: no
 * directories, no traversal, no control characters, bounded length. The
 * result is display/metadata only — storage paths are server-generated.
 */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\0-\x1f\x7f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, MAX_FILENAME_LENGTH);
  return cleaned === "" ? "file" : cleaned;
}

/**
 * Validate an upload claim against a bucket's rules. Checks extension
 * allowlist, MIME allowlist, extension↔MIME consistency (neither trusted
 * alone), and size bounds. Pure — no I/O, safe to run anywhere.
 *
 * NOTE: this validates CLAIMS. True content sniffing (magic bytes) and
 * malware scanning are future hardening; see docs/storage.md.
 */
export function validateUploadFile(
  file: UploadFileClaim,
  rules: BucketValidationRules,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const extension = getExtension(file.filename);

  if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < MIN_FILE_SIZE_BYTES) {
    issues.push({ field: "file", message: "File must not be empty." });
  } else if (file.sizeBytes > rules.maxFileSizeBytes) {
    issues.push({
      field: "file",
      message: `File exceeds the ${Math.round(rules.maxFileSizeBytes / 1024 / 1024)} MB limit.`,
    });
  }

  if (!rules.allowedExtensions.includes(extension)) {
    issues.push({
      field: "filename",
      message:
        extension === ""
          ? "File must have an extension."
          : `Files of type ".${extension}" are not allowed here.`,
    });
  }

  if (!rules.allowedMimeTypes.includes(file.mimeType)) {
    issues.push({ field: "mimeType", message: "This file type is not allowed here." });
  } else if (
    extension !== "" &&
    EXPECTED_MIME_TYPES[extension] !== undefined &&
    EXPECTED_MIME_TYPES[extension] !== file.mimeType
  ) {
    issues.push({
      field: "mimeType",
      message: "The file type does not match its extension.",
    });
  }

  return issues;
}

/** Validate against a bucket's configured rules by logical bucket name. */
export function validateUploadForBucket(
  file: UploadFileClaim,
  bucket: StorageBucket,
): ValidationIssue[] {
  return validateUploadFile(file, STORAGE_VALIDATION[bucket]);
}
