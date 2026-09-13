import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRepository } from "@/repositories/user.repository";
import type {
  PaginatedResult,
  PaginationParams,
  SessionUser,
  UserRole,
  UserStatus,
  Uuid,
} from "@/types";
import { toAppError, unwrapQuery } from "./errors";

const USER_COLUMNS = "id,email,role,status" as const;

interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    // The repository cannot see Supabase Auth; the session layer fills this
    // from the verified auth user (`email_confirmed_at`).
    emailVerifiedAt: null,
  };
}

/**
 * Supabase implementation of `UserRepository`. Receives its client via
 * constructor injection: request-scoped (RLS-aware) clients for self-reads,
 * the service-role client for administrative writes — server-side only.
 */
export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: Uuid): Promise<SessionUser | null> {
    const row = (await unwrapQuery(
      this.client.from("users").select(USER_COLUMNS).eq("id", id).maybeSingle(),
    )) as UserRow | null;
    return row ? toSessionUser(row) : null;
  }

  async findByAuthUserId(authUserId: Uuid): Promise<SessionUser | null> {
    const row = (await unwrapQuery(
      this.client
        .from("users")
        .select(USER_COLUMNS)
        .eq("auth_user_id", authUserId)
        .maybeSingle(),
    )) as UserRow | null;
    return row ? toSessionUser(row) : null;
  }

  async findByEmail(email: string): Promise<SessionUser | null> {
    const row = (await unwrapQuery(
      this.client
        .from("users")
        .select(USER_COLUMNS)
        .eq("email", email.trim().toLowerCase())
        .maybeSingle(),
    )) as UserRow | null;
    return row ? toSessionUser(row) : null;
  }

  async list(
    params: PaginationParams & { role?: UserRole },
  ): Promise<PaginatedResult<SessionUser>> {
    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    let query = this.client
      .from("users")
      .select(USER_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (params.role) {
      query = query.eq("role", params.role);
    }
    const result = await query;
    if (result.error) {
      throw toAppError(result.error, "Could not list users.");
    }
    const rows = (result.data ?? []) as UserRow[];
    const totalItems = result.count ?? rows.length;
    return {
      items: rows.map(toSessionUser),
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / params.pageSize)),
    };
  }

  async updateStatus(id: Uuid, status: UserStatus): Promise<SessionUser> {
    const row = (await unwrapQuery(
      this.client
        .from("users")
        .update({ status })
        .eq("id", id)
        .select(USER_COLUMNS)
        .single(),
    )) as UserRow;
    return toSessionUser(row);
  }

  async updateRole(id: Uuid, role: UserRole): Promise<SessionUser> {
    const row = (await unwrapQuery(
      this.client
        .from("users")
        .update({ role })
        .eq("id", id)
        .select(USER_COLUMNS)
        .single(),
    )) as UserRow;
    return toSessionUser(row);
  }

  async touchLastLogin(id: Uuid): Promise<void> {
    await unwrapQuery(
      this.client
        .from("users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", id),
    );
  }
}
