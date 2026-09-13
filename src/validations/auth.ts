import {
  isEmail,
  isNonEmptyString,
  type ValidationIssue,
} from "./common";

/**
 * Pure auth-input validators. Isomorphic (no Node APIs) so server actions
 * and client forms share the same rules; the server always re-validates.
 */

export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt truncates beyond 72 bytes server-side — reject earlier, clearly. */
export const MAX_PASSWORD_BYTES = 72;

/** Canonical email form: trimmed + lowercased (matches the DB constraint). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

export function validateEmailField(
  value: unknown,
  field = "email",
): ValidationIssue[] {
  if (!isNonEmptyString(value) || !isEmail(value.trim())) {
    return [{ field, message: "Enter a valid email address." }];
  }
  return [];
}

export function validateSignInInput(input: {
  email: unknown;
  password: unknown;
}): ValidationIssue[] {
  const issues = validateEmailField(input.email);
  // Sign-in says nothing about password policy (enumeration hygiene):
  // presence only, length-capped so absurd input fails fast.
  if (
    !isNonEmptyString(input.password) ||
    passwordByteLength(input.password) > MAX_PASSWORD_BYTES
  ) {
    issues.push({ field: "password", message: "Enter your password." });
  }
  return issues;
}

export function validateNewPassword(
  value: unknown,
  field = "password",
): ValidationIssue[] {
  if (!isNonEmptyString(value)) {
    return [{ field, message: "Enter a new password." }];
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return [
      {
        field,
        message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      },
    ];
  }
  if (passwordByteLength(value) > MAX_PASSWORD_BYTES) {
    return [
      {
        field,
        message: `Keep the password under ${MAX_PASSWORD_BYTES} bytes.`,
      },
    ];
  }
  return [];
}
