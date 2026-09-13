import type { PostgrestError } from "@supabase/supabase-js";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
  isAppError,
} from "@/lib/errors";

/**
 * Provider-error translation for the Supabase implementation.
 *
 * The business layer only ever sees `AppError` subclasses: user-safe
 * messages, correct HTTP statuses, no Supabase internals. Raw provider
 * detail (table names, constraint names, driver messages) is preserved on
 * `cause` for server-side logging — never for UI display.
 */

interface ProviderErrorShape {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
}

export function isNetworkErrorMessage(message: string): boolean {
  return /failed to fetch|fetch failed|network request failed|enotfound|econnrefused|econnreset|etimedout/i.test(
    message,
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Supabase reports HTTP statuses as numbers, or numeric strings. */
function readStatus(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d{3}$/.test(value)) {
    return Number(value);
  }
  return undefined;
}

export function toAppError(
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again.",
): AppError {
  if (isAppError(error)) {
    return error;
  }

  const shape: ProviderErrorShape =
    typeof error === "object" && error !== null
      ? (error as ProviderErrorShape)
      : {};
  const code = readString(shape.code);
  const message = readString(shape.message) ?? "";
  const status =
    readStatus(shape.status) ?? readStatus(shape.statusCode);

  if (message !== "" && isNetworkErrorMessage(message)) {
    return new ServiceUnavailableError(
      "The service is temporarily unreachable. Please check your connection and try again.",
    );
  }

  // Supabase Auth error codes.
  switch (code) {
    case "invalid_credentials":
      return new UnauthorizedError("Invalid email or password.");
    case "email_not_confirmed":
      return new ForbiddenError(
        "Please verify your email address, then try again.",
      );
    case "over_request_rate_limit":
      return new ServiceUnavailableError(
        "Too many attempts. Please wait a moment and try again.",
      );
  }

  // PostgREST / PostgreSQL error codes.
  switch (code) {
    case "PGRST116": // single-row query returned zero rows
      return new NotFoundError();
    case "23505": // unique violation
      return new ConflictError("This record already exists.");
    case "23503": // foreign-key violation
      return new ConflictError("This operation conflicts with related records.");
    case "42501": // RLS / permission denied
      return new ForbiddenError();
    case "22P02": // invalid input syntax
      return new ValidationError();
  }

  // HTTP-style statuses (Supabase Storage reports `statusCode`).
  switch (status) {
    case 400:
      return new ValidationError();
    case 401:
      return new UnauthorizedError();
    case 403:
      return new ForbiddenError();
    case 404:
      return new NotFoundError();
    case 409:
      return new ConflictError();
    case 429:
      return new ServiceUnavailableError(
        "Too many requests. Please wait a moment and try again.",
      );
  }
  if (status !== undefined && status >= 500) {
    return new ServiceUnavailableError();
  }

  return new AppError("PROVIDER_ERROR", fallbackMessage, {
    status: 500,
    cause: error,
  });
}

/**
 * Unwrap a PostgREST query result, translating failures via `toAppError`.
 *
 * This is the standard seam every future repository follows — repository
 * classes receive a Supabase client via constructor injection and unwrap
 * every query through this helper:
 *
 * ```ts
 * async findById(id: Uuid): Promise<SessionUser | null> {
 *   const row = await unwrapQuery(
 *     this.client.from("users").select("*").eq("id", id).maybeSingle(),
 *   );
 *   return row ? toSessionUser(row) : null;
 * }
 * ```
 */
export async function unwrapQuery<T>(
  query: PromiseLike<{ data: T; error: PostgrestError | null }>,
): Promise<T> {
  const result = await query;
  if (result.error) {
    throw toAppError(result.error);
  }
  return result.data;
}
