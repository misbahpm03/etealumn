import type {
  DocumentPermissionKind,
  DocumentSearchInput,
  DocumentSearchQuery,
  DocumentStatus,
  DocumentVisibility,
  PublicDocumentSearchInput,
  PublicDocumentSearchQuery,
} from "@/types";
import {
  DOCUMENT_PERMISSIONS,
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITIES,
} from "@/types";
import {
  isNonEmptyString,
  isOneOf,
  isUuid,
  type ValidationIssue,
} from "./common";

/**
 * Pure archive validators (Phase 9). Isomorphic — no Node APIs. The SERVICE
 * always validates before mutating; repositories trust service-shaped input.
 */

export const DOCUMENT_LIMITS = {
  titleMax: 300,
  slugMax: 120,
  descriptionMax: 5000,
  abstractMax: 10000,
  supervisorMax: 200,
  keywordMax: 60,
  keywordCountMax: 20,
  changeNoteMax: 1000,
  textMax: 100,
  filterMax: 100,
  pageSizeDefault: 20,
  pageSizeMax: 50,
  maxOffset: 1000,
  yearMin: 1900,
  yearMax: 2100,
} as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const VISIBILITIES: ReadonlyArray<DocumentVisibility> = Object.values(
  DOCUMENT_VISIBILITIES,
);
const STATUSES: ReadonlyArray<DocumentStatus> =
  Object.values(DOCUMENT_STATUSES);
const PERMISSIONS: ReadonlyArray<DocumentPermissionKind> = Object.values(
  DOCUMENT_PERMISSIONS,
);

/**
 * The ONLY legal status transitions. Anything else (including direct
 * DRAFT→APPROVED self-approval) is rejected by the service before any
 * mutation is attempted; the `documents_lifecycle_guard` database trigger
 * is the final backstop authority.
 */
const LIFECYCLE_TRANSITIONS: Record<DocumentStatus, ReadonlyArray<DocumentStatus>> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ARCHIVED"],
  REJECTED: ["DRAFT"],
  ARCHIVED: [],
};

export function isAllowedTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): boolean {
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}

export function isValidDocumentSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= DOCUMENT_LIMITS.slugMax &&
    SLUG_PATTERN.test(value)
  );
}

function checkText(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
  max: number,
  opts: { required?: boolean; allowNull?: boolean } = {},
): void {
  if (value === undefined) return;
  if (value === null) {
    if (!opts.allowNull) {
      issues.push({ field, message: "This field cannot be cleared." });
    }
    return;
  }
  if (typeof value !== "string") {
    issues.push({ field, message: "Enter text." });
    return;
  }
  if (value.trim() === "") {
    if (opts.required) issues.push({ field, message: "Required." });
    else issues.push({ field, message: "Enter text or leave blank." });
    return;
  }
  if (value.length > max) {
    issues.push({ field, message: `Keep this under ${max} characters.` });
  }
}

function checkYear(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
): void {
  if (value === undefined || value === null) return;
  const year = typeof value === "string" ? Number(value) : value;
  if (
    typeof year !== "number" ||
    !Number.isInteger(year) ||
    year < DOCUMENT_LIMITS.yearMin ||
    year > DOCUMENT_LIMITS.yearMax
  ) {
    issues.push({
      field,
      message: `Enter a year between ${DOCUMENT_LIMITS.yearMin} and ${DOCUMENT_LIMITS.yearMax}.`,
    });
  }
}

function checkUuidField(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
  opts: { required?: boolean; allowNull?: boolean } = {},
): void {
  if (value === undefined) return;
  if (value === null) {
    if (!opts.allowNull) issues.push({ field, message: "Required." });
    return;
  }
  if (!isUuid(value)) {
    issues.push({ field, message: "Invalid reference." });
    return;
  }
  if (opts.required && (value as string).trim() === "") {
    issues.push({ field, message: "Required." });
  }
}

function checkBoolean(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
): void {
  if (value === undefined) return;
  if (typeof value !== "boolean") {
    issues.push({ field, message: "Must be true or false." });
  }
}

function checkKeywords(
  issues: ValidationIssue[],
  value: unknown,
): void {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) {
    issues.push({ field: "keywords", message: "Keywords must be a list." });
    return;
  }
  if (value.length > DOCUMENT_LIMITS.keywordCountMax) {
    issues.push({
      field: "keywords",
      message: `Use at most ${DOCUMENT_LIMITS.keywordCountMax} keywords.`,
    });
    return;
  }
  for (const keyword of value) {
    if (
      typeof keyword !== "string" ||
      keyword.trim() === "" ||
      keyword.length > DOCUMENT_LIMITS.keywordMax
    ) {
      issues.push({
        field: "keywords",
        message: `Each keyword must be 1–${DOCUMENT_LIMITS.keywordMax} characters.`,
      });
      return;
    }
  }
}

/** Trim, drop empties, dedupe (preserving order). Null when absent. */
export function normalizeKeywords(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const keyword of value) {
    if (typeof keyword !== "string") continue;
    const trimmed = keyword.trim().replace(/\s+/g, " ");
    if (trimmed === "" || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    out.push(trimmed);
  }
  return out;
}

export function validateDocumentSlug(value: unknown): ValidationIssue[] {
  if (value === undefined || value === null) return [];
  if (!isValidDocumentSlug(value)) {
    return [
      {
        field: "slug",
        message:
          "Use 3–120 lowercase letters, numbers, and hyphens (e.g. my-thesis-2024).",
      },
    ];
  }
  return [];
}

export interface DocumentMetadataInput {
  title?: unknown;
  slug?: unknown;
  description?: unknown;
  abstract?: unknown;
  year?: unknown;
  supervisorName?: unknown;
  keywords?: unknown;
  visibility?: unknown;
  allowDownload?: unknown;
  categoryId?: unknown;
  batchId?: unknown;
}

function checkMetadata(
  issues: ValidationIssue[],
  input: DocumentMetadataInput,
  opts: { forCreate: boolean },
): void {
  checkText(issues, "title", input.title, DOCUMENT_LIMITS.titleMax, {
    required: opts.forCreate,
  });
  issues.push(...validateDocumentSlug(input.slug));
  checkText(issues, "description", input.description, DOCUMENT_LIMITS.descriptionMax, {
    allowNull: true,
  });
  checkText(issues, "abstract", input.abstract, DOCUMENT_LIMITS.abstractMax, {
    allowNull: true,
  });
  checkText(
    issues,
    "supervisorName",
    input.supervisorName,
    DOCUMENT_LIMITS.supervisorMax,
    { allowNull: true },
  );
  checkYear(issues, "year", input.year);
  checkKeywords(issues, input.keywords);
  if (input.visibility !== undefined && !isOneOf(input.visibility, VISIBILITIES)) {
    issues.push({ field: "visibility", message: "Select a visibility." });
  }
  checkBoolean(issues, "allowDownload", input.allowDownload);
  checkUuidField(issues, "categoryId", input.categoryId, {
    required: opts.forCreate,
  });
  checkUuidField(issues, "batchId", input.batchId, { allowNull: true });
}

export function validateCreateDocument(input: DocumentMetadataInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkMetadata(issues, input, { forCreate: true });
  return issues;
}

export function validateUpdateDocument(input: DocumentMetadataInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkMetadata(issues, input, { forCreate: false });
  return issues;
}

export function validateChangeNote(value: unknown): ValidationIssue[] {
  if (value === undefined || value === null) return [];
  if (
    !isNonEmptyString(value) ||
    value.length > DOCUMENT_LIMITS.changeNoteMax
  ) {
    return [
      {
        field: "changeNote",
        message: `Keep the change note under ${DOCUMENT_LIMITS.changeNoteMax} characters.`,
      },
    ];
  }
  return [];
}

export function validateGrantPermission(input: {
  userId?: unknown;
  permission?: unknown;
  expiresAt?: unknown;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isUuid(input.userId)) {
    issues.push({ field: "userId", message: "Select a valid member." });
  }
  if (!isOneOf(input.permission, PERMISSIONS)) {
    issues.push({ field: "permission", message: "Select VIEW or DOWNLOAD." });
  }
  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    if (typeof input.expiresAt !== "string") {
      issues.push({ field: "expiresAt", message: "Enter a valid expiry date." });
    } else {
      const when = new Date(input.expiresAt).getTime();
      if (Number.isNaN(when)) {
        issues.push({ field: "expiresAt", message: "Enter a valid expiry date." });
      } else if (when <= Date.now()) {
        issues.push({ field: "expiresAt", message: "Expiry must be in the future." });
      }
    }
  }
  return issues;
}

function checkSearchText(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
  max: number,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    issues.push({ field, message: "Enter text to search for." });
    return null;
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed === "") return null;
  if (trimmed.length > max) {
    issues.push({ field, message: `Keep this under ${max} characters.` });
    return null;
  }
  return trimmed;
}

function checkPageNumber(issues: ValidationIssue[], value: unknown): number {
  if (value === undefined || value === null || value === "") return 1;
  const page = typeof value === "string" ? Number(value) : value;
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1) {
    issues.push({ field: "page", message: "Enter a valid page number." });
    return 1;
  }
  return page;
}

function checkPageSize(issues: ValidationIssue[], value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return DOCUMENT_LIMITS.pageSizeDefault;
  }
  const size = typeof value === "string" ? Number(value) : value;
  if (
    typeof size !== "number" ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > DOCUMENT_LIMITS.pageSizeMax
  ) {
    issues.push({
      field: "pageSize",
      message: `Page size must be between 1 and ${DOCUMENT_LIMITS.pageSizeMax}.`,
    });
    return DOCUMENT_LIMITS.pageSizeDefault;
  }
  return size;
}

function checkSearchYear(
  issues: ValidationIssue[],
  value: unknown,
): number | null {
  if (value === undefined || value === null || value === "") return null;
  const year = typeof value === "string" ? Number(value) : value;
  if (
    typeof year !== "number" ||
    !Number.isInteger(year) ||
    year < DOCUMENT_LIMITS.yearMin ||
    year > DOCUMENT_LIMITS.yearMax
  ) {
    issues.push({
      field: "year",
      message: `Enter a year between ${DOCUMENT_LIMITS.yearMin} and ${DOCUMENT_LIMITS.yearMax}.`,
    });
    return null;
  }
  return year;
}

function checkSearchUuid(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (!isUuid(value)) {
    issues.push({ field, message: "Invalid reference." });
    return null;
  }
  return value;
}

export function validateDocumentSearch(input: DocumentSearchInput): {
  query: DocumentSearchQuery;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const text = checkSearchText(issues, "text", input.text, DOCUMENT_LIMITS.textMax);
  const supervisor = checkSearchText(
    issues,
    "supervisor",
    input.supervisor,
    DOCUMENT_LIMITS.filterMax,
  );
  const keyword = checkSearchText(
    issues,
    "keyword",
    input.keyword,
    DOCUMENT_LIMITS.keywordMax,
  );
  const categoryId = checkSearchUuid(issues, "categoryId", input.categoryId);
  const batchId = checkSearchUuid(issues, "batchId", input.batchId);
  const year = checkSearchYear(issues, input.year);
  let visibility: DocumentVisibility | null = null;
  if (input.visibility !== undefined && input.visibility !== null && input.visibility !== "") {
    if (!isOneOf(input.visibility, VISIBILITIES)) {
      issues.push({ field: "visibility", message: "Select a valid visibility." });
    } else {
      visibility = input.visibility;
    }
  }
  let status: DocumentStatus | null = null;
  if (input.status !== undefined && input.status !== null && input.status !== "") {
    if (!isOneOf(input.status, STATUSES)) {
      issues.push({ field: "status", message: "Select a valid status." });
    } else {
      status = input.status;
    }
  }
  let ownOnly = false;
  if (input.ownOnly !== undefined && input.ownOnly !== null && input.ownOnly !== "") {
    if (input.ownOnly === true || input.ownOnly === "true") ownOnly = true;
    else if (input.ownOnly === false || input.ownOnly === "false") ownOnly = false;
    else issues.push({ field: "ownOnly", message: "Invalid filter." });
  }
  const page = checkPageNumber(issues, input.page);
  const limit = checkPageSize(issues, input.pageSize);
  const offset = (page - 1) * limit;
  if (offset > DOCUMENT_LIMITS.maxOffset) {
    issues.push({
      field: "page",
      message: "This page is too deep to browse. Narrow the search instead.",
    });
  }
  return {
    query: {
      text,
      supervisor,
      keyword,
      categoryId,
      batchId,
      year,
      visibility,
      status,
      ownOnly,
      limit,
      offset,
    },
    issues,
  };
}

export function validatePublicDocumentSearch(input: PublicDocumentSearchInput): {
  query: PublicDocumentSearchQuery;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const text = checkSearchText(issues, "text", input.text, DOCUMENT_LIMITS.textMax);
  let categorySlug: string | null = null;
  if (
    input.categorySlug !== undefined &&
    input.categorySlug !== null &&
    input.categorySlug !== ""
  ) {
    if (typeof input.categorySlug !== "string" || !isValidDocumentSlug(input.categorySlug)) {
      issues.push({ field: "categorySlug", message: "Select a valid category." });
    } else {
      categorySlug = input.categorySlug;
    }
  }
  const year = checkSearchYear(issues, input.year);
  const page = checkPageNumber(issues, input.page);
  const limit = checkPageSize(issues, input.pageSize);
  const offset = (page - 1) * limit;
  if (offset > DOCUMENT_LIMITS.maxOffset) {
    issues.push({
      field: "page",
      message: "This page is too deep to browse. Narrow the search instead.",
    });
  }
  return { query: { text, categorySlug, year, limit, offset }, issues };
}
