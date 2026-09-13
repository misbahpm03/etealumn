import "server-only";

/**
 * Auth audit boundary (Phase 6: service seam only, no database writes).
 *
 * Auth flows log security-relevant events through `getAuthAuditLogger()`
 * instead of scattering `console` calls. The default sink is structured
 * server-side logging; a later audit phase swaps in a database-backed
 * implementation without touching call sites.
 *
 * Privacy: events carry user IDS only — never emails, never tokens, never
 * secrets. Ordinary users can never write audit records (the logger is
 * server-only and the future DB sink will use a privileged client).
 */

export type AuthAuditEvent =
  | "login"
  | "logout"
  | "password_reset_requested"
  | "password_updated"
  | "verification_email_resent"
  | "role_changed"
  | "status_changed";

export interface AuthAuditDetails {
  authUserId?: string;
  appUserId?: string;
}

export interface AuthAuditLogger {
  log(event: AuthAuditEvent, details?: AuthAuditDetails): void;
}

let logger: AuthAuditLogger | null = null;

/** Override the sink (audit phase, tests). Server-only by module graph. */
export function setAuthAuditLogger(next: AuthAuditLogger | null): void {
  logger = next;
}

const consoleSink: AuthAuditLogger = {
  log(event, details = {}) {
    console.info(
      JSON.stringify({ scope: "auth-audit", event, ...details }),
    );
  },
};

export function getAuthAuditLogger(): AuthAuditLogger {
  return logger ?? consoleSink;
}
