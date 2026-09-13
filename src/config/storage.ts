/**
 * Logical storage areas. Business logic and the database reference these
 * logical bucket names — never hardcoded URLs. The active StorageProvider
 * maps them to physical provider buckets/paths (currently 1:1).
 *
 * ALL buckets are private. There is no public bucket by design: every file
 * delivery — including for publicly visible content — goes through
 * authorization followed by a short-lived signed URL minted server-side.
 */
export const STORAGE_BUCKETS = {
  PROFILE_MEDIA: "profile-media",
  ACADEMIC_ARCHIVE: "academic-archive",
  STORY_MEDIA: "story-media",
  ACHIEVEMENT_MEDIA: "achievement-media",
  DEPARTMENT_MEMORY_MEDIA: "department-memory-media",
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/** Sensible upload guardrails; enforced again provider-side. */
export const STORAGE_LIMITS = {
  /**
   * Default max single-file upload size: 25 MB, applied uniformly until
   * product requirements define per-bucket limits. Mirrored as bucket
   * `file_size_limit` in the storage migration (kept in sync manually —
   * SQL and TypeScript share no constants).
   */
  maxFileSizeBytes: 25 * 1024 * 1024,
  /** Default signed-URL lifetime: 1 hour. Prefer shorter per-call. */
  defaultSignedUrlExpiresInSeconds: 60 * 60,
  /**
   * Recommended signed-URL lifetime for file downloads: 15 minutes.
   * Services pass this explicitly; the 1-hour default stays a backstop.
   */
  downloadSignedUrlExpiresInSeconds: 15 * 60,
} as const;

export interface BucketValidationRules {
  /** Lowercase extensions WITHOUT the leading dot. */
  allowedExtensions: ReadonlyArray<string>;
  /** Exact MIME types accepted for this bucket. */
  allowedMimeTypes: ReadonlyArray<string>;
  maxFileSizeBytes: number;
}

/**
 * Central, configurable upload validation rules per bucket. The extension↔MIME
 * consistency check uses EXPECTED_MIME_TYPES below. Executables, scripts, and
 * HTML/SVG are deliberately absent everywhere (XSS/malware hardening).
 */
export const STORAGE_VALIDATION: Record<StorageBucket, BucketValidationRules> = {
  [STORAGE_BUCKETS.PROFILE_MEDIA]: {
    allowedExtensions: ["png", "jpg", "jpeg", "webp", "gif"],
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    maxFileSizeBytes: STORAGE_LIMITS.maxFileSizeBytes,
  },
  [STORAGE_BUCKETS.ACADEMIC_ARCHIVE]: {
    allowedExtensions: [
      "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
      "txt", "md", "csv", "tex", "png", "jpg", "jpeg", "zip",
    ],
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/x-tex",
      "image/png",
      "image/jpeg",
      "application/zip",
    ],
    maxFileSizeBytes: STORAGE_LIMITS.maxFileSizeBytes,
  },
  [STORAGE_BUCKETS.STORY_MEDIA]: {
    allowedExtensions: ["png", "jpg", "jpeg", "webp", "gif"],
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    maxFileSizeBytes: STORAGE_LIMITS.maxFileSizeBytes,
  },
  [STORAGE_BUCKETS.ACHIEVEMENT_MEDIA]: {
    allowedExtensions: ["png", "jpg", "jpeg", "webp", "gif"],
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    maxFileSizeBytes: STORAGE_LIMITS.maxFileSizeBytes,
  },
  [STORAGE_BUCKETS.DEPARTMENT_MEMORY_MEDIA]: {
    allowedExtensions: ["png", "jpg", "jpeg", "webp", "gif"],
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    maxFileSizeBytes: STORAGE_LIMITS.maxFileSizeBytes,
  },
};

/** Expected MIME per extension — the consistency check never trusts either alone. */
export const EXPECTED_MIME_TYPES: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  tex: "application/x-tex",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  zip: "application/zip",
  webp: "image/webp",
  gif: "image/gif",
};
