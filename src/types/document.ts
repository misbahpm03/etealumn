/**
 * Academic archive document kinds.
 */
export const DOCUMENT_TYPES = {
  THESIS: "THESIS",
  THESIS_BOOK: "THESIS_BOOK",
  PROJECT_REPORT: "PROJECT_REPORT",
  RESEARCH_PAPER: "RESEARCH_PAPER",
  PUBLICATION: "PUBLICATION",
  CONFERENCE_PAPER: "CONFERENCE_PAPER",
  JOURNAL_PAPER: "JOURNAL_PAPER",
  TECHNICAL_REPORT: "TECHNICAL_REPORT",
  LAB_REPORT: "LAB_REPORT",
  OTHER: "OTHER",
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

/**
 * Who a document is visible to. PRIVATE means "Only Me" unless explicit
 * permissions were granted. Visibility is orthogonal to approval status.
 */
export const DOCUMENT_VISIBILITIES = {
  PUBLIC: "PUBLIC",
  STUDENT_ONLY: "STUDENT_ONLY",
  FACULTY_ONLY: "FACULTY_ONLY",
  PRIVATE: "PRIVATE",
} as const;

export type DocumentVisibility =
  (typeof DOCUMENT_VISIBILITIES)[keyof typeof DOCUMENT_VISIBILITIES];

/**
 * Document lifecycle: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED
 * (or → REJECTED → edit → resubmit). PUBLIC visibility additionally requires
 * an approved/published status.
 */
export const DOCUMENT_STATUSES = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ARCHIVED: "ARCHIVED",
} as const;

export type DocumentStatus =
  (typeof DOCUMENT_STATUSES)[keyof typeof DOCUMENT_STATUSES];

/** Explicit per-document grants. DOWNLOAD implies nothing — check separately. */
export const DOCUMENT_PERMISSIONS = {
  VIEW: "VIEW",
  DOWNLOAD: "DOWNLOAD",
} as const;

export type DocumentPermissionKind =
  (typeof DOCUMENT_PERMISSIONS)[keyof typeof DOCUMENT_PERMISSIONS];
