import type { Uuid } from "@/types";

/**
 * Append-only audit writes. There is deliberately no read/list method for
 * application use (audit reads are admin-only via RLS) and no update/delete
 * (the database trigger rejects mutation). Runs privileged: no INSERT grant
 * exists for API roles, so ordinary users can never write audit records.
 *
 * Metadata must NEVER contain credentials, tokens, or sensitive profile
 * values — field names and non-sensitive references only.
 */
export interface AuditLogInput {
  actorId: Uuid | null;
  action: string;
  entityType: string;
  entityId?: Uuid | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogRepository {
  record(input: AuditLogInput): Promise<void>;
}
