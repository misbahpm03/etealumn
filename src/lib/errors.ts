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

// --- Authentication & account-state errors (Phase 6). ---

/**
 * Wrong email/password — or unknown account; the message is deliberately
 * identical either way so login cannot enumerate accounts.
 */
export class InvalidCredentialsError extends AppError {
  constructor(message = "Invalid email or password.") {
    super("INVALID_CREDENTIALS", message, { status: 401 });
  }
}

/** Session is missing, expired, or can no longer be refreshed. */
export class SessionExpiredError extends AppError {
  constructor(message = "Your session has expired. Please sign in again.") {
    super("SESSION_EXPIRED", message, { status: 401 });
  }
}

/** Supabase identity exists but the email address is not confirmed yet. */
export class EmailNotVerifiedError extends AppError {
  constructor(message = "Please verify your email address, then try again.") {
    super("EMAIL_NOT_VERIFIED", message, { status: 403 });
  }
}

/** Authenticated, but the application account is still PENDING. */
export class PendingAccountError extends AppError {
  constructor(
    message = "Your account is pending review. You will get access once it is approved.",
  ) {
    super("PENDING_ACCOUNT", message, { status: 403 });
  }
}

/** Authenticated, but the account is SUSPENDED. */
export class SuspendedAccountError extends AppError {
  constructor(
    message = "Your account is suspended. Please contact support for help.",
  ) {
    super("SUSPENDED_ACCOUNT", message, { status: 403 });
  }
}

/** Authenticated, but the account is DEACTIVATED. */
export class DeactivatedAccountError extends AppError {
  constructor(
    message = "Your account is deactivated. Please contact support for help.",
  ) {
    super("DEACTIVATED_ACCOUNT", message, { status: 403 });
  }
}

/**
 * Authenticated with Supabase, but no `public.users` row exists — the
 * provisioning trigger never ran (or the row was deleted). A server-side
 * inconsistency: 500 with a user-safe message, never a stack trace.
 */
export class MissingAppUserError extends AppError {
  constructor(
    message = "Your account setup is incomplete. Please contact support.",
  ) {
    super("MISSING_APP_USER", message, { status: 500 });
  }
}

/**
 * App user exists but the expected profile row is missing. Provisioning
 * creates both atomically, so this is an invariant violation, not a flow.
 */
export class MissingProfileError extends AppError {
  constructor(
    message = "Your profile could not be loaded. Please contact support.",
  ) {
    super("MISSING_PROFILE", message, { status: 500 });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
