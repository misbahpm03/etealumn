import { isValidSlug } from "@/lib/slug";
import type {
  DirectoryRole,
  DirectorySearchInput,
  DirectorySearchQuery,
} from "@/types";
import { isOneOf, isUuid, type ValidationIssue } from "./common";

/**
 * Pure directory validators (Phase 8). Isomorphic — no Node APIs — so route
 * handlers, services, and (where useful) client hints share the rules. The
 * SERVICE always validates before querying: the repository trusts only
 * `DirectorySearchQuery`.
 */

export const DIRECTORY_LIMITS = {
  textMax: 100,
  filterMax: 100,
  pageSizeDefault: 20,
  pageSizeMax: 50,
  /** Deep-offset guard: page * pageSize may not exceed this. */
  maxOffset: 1000,
  yearMin: 1900,
  yearMax: 2100,
} as const;

const DIRECTORY_ROLES: ReadonlyArray<DirectoryRole> = [
  "ALUMNI",
  "STUDENT",
  "FACULTY",
];

function invalid(message: string, field: string): ValidationIssue[] {
  return [{ field, message }];
}

/** Public profile route param — must look like a generated slug. */
export function validateSlug(value: unknown): ValidationIssue[] {
  if (!isValidSlug(value)) {
    return invalid("Invalid profile address.", "slug");
  }
  return [];
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

function checkYear(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
): number | null {
  if (value === undefined || value === null || value === "") return null;
  const year = typeof value === "string" ? Number(value) : value;
  if (
    typeof year !== "number" ||
    !Number.isInteger(year) ||
    year < DIRECTORY_LIMITS.yearMin ||
    year > DIRECTORY_LIMITS.yearMax
  ) {
    issues.push({
      field,
      message: `Enter a year between ${DIRECTORY_LIMITS.yearMin} and ${DIRECTORY_LIMITS.yearMax}.`,
    });
    return null;
  }
  return year;
}

function checkBatchId(
  issues: ValidationIssue[],
  value: unknown,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (!isUuid(value)) {
    issues.push({ field: "batchId", message: "Select a valid batch." });
    return null;
  }
  return value;
}

function checkRole(
  issues: ValidationIssue[],
  value: unknown,
): DirectoryRole | null {
  if (value === undefined || value === null || value === "") return null;
  if (!isOneOf(value, DIRECTORY_ROLES)) {
    issues.push({ field: "role", message: "Select a valid directory." });
    return null;
  }
  return value;
}

function checkPageNumber(
  issues: ValidationIssue[],
  value: unknown,
): number {
  if (value === undefined || value === null || value === "") return 1;
  const page = typeof value === "string" ? Number(value) : value;
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1) {
    issues.push({ field: "page", message: "Enter a valid page number." });
    return 1;
  }
  return page;
}

function checkPageSize(
  issues: ValidationIssue[],
  value: unknown,
): number {
  if (value === undefined || value === null || value === "") {
    return DIRECTORY_LIMITS.pageSizeDefault;
  }
  const size = typeof value === "string" ? Number(value) : value;
  if (
    typeof size !== "number" ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > DIRECTORY_LIMITS.pageSizeMax
  ) {
    issues.push({
      field: "pageSize",
      message: `Page size must be between 1 and ${DIRECTORY_LIMITS.pageSizeMax}.`,
    });
    return DIRECTORY_LIMITS.pageSizeDefault;
  }
  return size;
}

/**
 * Validate + normalize raw search input. Returns the clean query plus any
 * issues (the service throws ValidationError when issues are non-empty).
 * Empty searches are VALID (they list public profiles, paged) — but the
 * offset cap keeps deep pagination bounded.
 */
export function validateDirectorySearch(input: DirectorySearchInput): {
  query: DirectorySearchQuery;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const text = checkSearchText(issues, "text", input.text, DIRECTORY_LIMITS.textMax);
  const company = checkSearchText(issues, "company", input.company, DIRECTORY_LIMITS.filterMax);
  const designation = checkSearchText(
    issues,
    "designation",
    input.designation,
    DIRECTORY_LIMITS.filterMax,
  );
  const location = checkSearchText(
    issues,
    "location",
    input.location,
    DIRECTORY_LIMITS.filterMax,
  );
  const batchId = checkBatchId(issues, input.batchId);
  const graduationYear = checkYear(issues, "graduationYear", input.graduationYear);
  const role = checkRole(issues, input.role);
  const page = checkPageNumber(issues, input.page);
  const limit = checkPageSize(issues, input.pageSize);
  const offset = (page - 1) * limit;
  if (offset > DIRECTORY_LIMITS.maxOffset) {
    issues.push({
      field: "page",
      message: "This page is too deep to browse. Narrow the search instead.",
    });
  }
  return {
    query: {
      text,
      batchId,
      graduationYear,
      company,
      designation,
      location,
      role,
      limit,
      offset,
    },
    issues,
  };
}
