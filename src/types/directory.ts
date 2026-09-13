import type { Uuid } from "./common";
import type { SafePublicProfile } from "./profile";

/**
 * Public directory DTOs (Phase 8). These are the ONLY shapes public pages
 * may consume — raw profile tables are not the public API.
 *
 * Invariants: no user_id, no auth identifiers, no photo paths (delivery goes
 * through the server photo endpoint), no student internals, no mentorship
 * internals, no audit/session data. Every nullable field here was already
 * gated by its show_* flag inside the database views.
 */

/** Directory-eligible roles. Staff (MODERATOR/ADMIN) never appear. */
export type DirectoryRole = "ALUMNI" | "STUDENT" | "FACULTY";

/** One public career entry (`work_experience_public` view — no row ids). */
export interface PublicWorkItem {
  company: string;
  designation: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  displayOrder: number;
}

/** One public education entry (`education_public` view — no row ids). */
export interface PublicEducationItem {
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
  description: string | null;
  displayOrder: number;
}

/**
 * Full public profile for the detail page: the safe projection plus the
 * flag-gated career/education lists (empty arrays when the owner opted out
 * — never null, so the UI can't confuse "hidden" with "missing").
 */
export interface PublicProfileDetail extends SafePublicProfile {
  work: ReadonlyArray<PublicWorkItem>;
  education: ReadonlyArray<PublicEducationItem>;
}

/** Public-safe batch metadata (cover image path deliberately excluded). */
export interface PublicBatch {
  id: Uuid;
  name: string;
  batchNumber: number | null;
  admissionYear: number | null;
  graduationYear: number | null;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
}

/** Raw directory search input (query params — ALWAYS validated by the service). */
export interface DirectorySearchInput {
  text?: unknown;
  batchId?: unknown;
  graduationYear?: unknown;
  company?: unknown;
  designation?: unknown;
  location?: unknown;
  role?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

/** Validated + normalized search query handed to the repository. */
export interface DirectorySearchQuery {
  text: string | null;
  batchId: Uuid | null;
  graduationYear: number | null;
  company: string | null;
  designation: string | null;
  location: string | null;
  role: DirectoryRole | null;
  limit: number;
  offset: number;
}

/** Paged directory result. `total` counts visibility-eligible rows only. */
export interface DirectorySearchResult {
  rows: ReadonlyArray<SafePublicProfile>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Batch member listing (same visibility rules as directory search). */
export interface BatchMemberResult {
  batch: PublicBatch;
  members: ReadonlyArray<SafePublicProfile>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
