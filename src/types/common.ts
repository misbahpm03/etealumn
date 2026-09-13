/** UUID v4 primary key, as stored in PostgreSQL. */
export type Uuid = string;

/** ISO 8601 date-time string (UTC). */
export type IsoDateString = string;

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: ReadonlyArray<T>;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface Timestamped {
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface SoftDeletable {
  deletedAt: IsoDateString | null;
}
