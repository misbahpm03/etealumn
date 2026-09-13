/**
 * Shared application error hierarchy.
 *
 * Services and repositories throw these (or subclasses) instead of ad-hoc
 * `Error`s so route handlers and server actions can map failures to correct
 * HTTP statuses and user-safe messages in one place.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    options: { status?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.status = options.status ?? 500;
    this.retryable = options.retryable ?? false;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource", options?: { cause?: unknown }) {
    super("NOT_FOUND", `${resource} not found.`, { status: 404, ...options });
  }
}

export class ValidationError extends AppError {
  readonly issues: ReadonlyArray<{ field: string; message: string }>;

  constructor(
    issues: ReadonlyArray<{ field: string; message: string }> = [],
    message = "Validation failed.",
  ) {
    super("VALIDATION_ERROR", message, { status: 400 });
    this.issues = issues;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.") {
    super("UNAUTHORIZED", message, { status: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super("FORBIDDEN", message, { status: 403 });
  }
}

export class ConflictError extends AppError {
  constructor(message = "This operation conflicts with the current state.") {
    super("CONFLICT", message, { status: 409 });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "The service is temporarily unavailable.") {
    super("SERVICE_UNAVAILABLE", message, { status: 503, retryable: true });
  }
}

/** Thrown when a provider-backed service is used before being configured. */
export class ServiceNotConfiguredError extends AppError {
  constructor(serviceName: string) {
    super(
      "SERVICE_NOT_CONFIGURED",
      `${serviceName} is not configured yet.`,
      { status: 503 },
    );
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
