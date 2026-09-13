/**
 * Logical storage areas. Business logic and the database reference these
 * logical bucket names — never hardcoded URLs. The active StorageProvider
 * maps them to physical provider buckets/paths.
 *
 * Private content must never live in a publicly accessible bucket; access is
 * granted through authorized, signed URLs minted at request time.
 */
export const STORAGE_BUCKETS = {
  PROFILE_MEDIA: "profile-media",
  ACADEMIC_DOCUMENTS: "academic-documents",
  STORY_MEDIA: "story-media",
  ACHIEVEMENT_MEDIA: "achievement-media",
  MEMORY_MEDIA: "memory-media",
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/** Sensible upload guardrails; enforced again provider-side. */
export const STORAGE_LIMITS = {
  /** Max single-file upload size: 25 MB. */
  maxFileSizeBytes: 25 * 1024 * 1024,
  /** Default signed-URL lifetime: 1 hour. */
  defaultSignedUrlExpiresInSeconds: 60 * 60,
} as const;
