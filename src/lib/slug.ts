/**
 * Server-generated public profile slugs (Phase 8).
 *
 * Slugs are the ONLY public identifier for directory profiles — user IDs
 * never appear in public URLs, DTOs, or search. Generation is server-side
 * only: there is no user-chosen slug path in this phase, so slug claiming /
 * squatting attacks structurally cannot occur. Uniqueness is enforced by
 * the `profiles.profile_slug` UNIQUE constraint; callers retry with a fresh
 * suffix on ConflictError.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 60;
const MAX_NAME_PART_LENGTH = 40;
const SUFFIX_LENGTH = 6;
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** True when the value is a well-formed public slug (route-param gate). */
export function isValidSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(value)
  );
}

function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SUFFIX_LENGTH));
  let suffix = "";
  for (const byte of bytes) {
    suffix += SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length];
  }
  return suffix;
}

/**
 * Build a unique-candidate slug from a human name. The random suffix makes
 * collisions (same name) vanishingly unlikely and makes slugs unguessable
 * enough that sequential profile enumeration is infeasible.
 */
export function generateProfileSlug(sourceName: string): string {
  return `${baseSlug(sourceName, "member")}-${randomSuffix()}`;
}

/**
 * Build a unique-candidate slug for an archive document. Same no-oracle
 * posture as profile slugs: on collision the service retries with a fresh
 * suffix instead of reporting "taken".
 */
export function generateDocumentSlug(title: string): string {
  return `${baseSlug(title, "document")}-${randomSuffix()}`;
}

function baseSlug(source: string, fallback: string): string {
  const namePart = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME_PART_LENGTH)
    .replace(/-+$/g, "");
  return namePart === "" ? fallback : namePart;
}
