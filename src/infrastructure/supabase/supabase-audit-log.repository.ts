import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditLogInput,
  AuditLogRepository,
} from "@/repositories/audit-log.repository";
import { unwrapQuery } from "./errors";

/**
 * Append-only audit writer. Always constructed with the privileged client
 * (no INSERT grant exists for API roles). Callers are responsible for
 * keeping metadata free of credentials and sensitive profile values.
 */
export class SupabaseAuditLogRepository implements AuditLogRepository {
  constructor(private readonly client: SupabaseClient) {}

  async record(input: AuditLogInput): Promise<void> {
    await unwrapQuery(
      this.client.from("audit_logs").insert({
        actor_id: input.actorId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? null,
      }),
    );
  }
}
