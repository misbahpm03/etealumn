import type { PaginationParams } from "@/types";

export interface ValidationIssue {
  field: string;
  message: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Pragmatic format check — deliverability is verified out of band. */
export function isEmail(value: unknown): value is string {
  return (
    typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value)
  );
}

export function isOneOf<T extends string>(
  value: unknown,
  allowed: ReadonlyArray<T>,
): value is T {
  return (
    typeof value === "string" &&
    (allowed as ReadonlyArray<string>).includes(value)
  );
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Parse `page`/`pageSize` from untrusted input, clamping to safe bounds.
 * Never throws — falls back to defaults.
 */
export function parsePagination(input: {
  page?: unknown;
  pageSize?: unknown;
}): PaginationParams {
  const page = Number(input.page);
  const pageSize = Number(input.pageSize);

  return {
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE,
    pageSize:
      Number.isInteger(pageSize) && pageSize > 0
        ? Math.min(pageSize, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE,
  };
}
