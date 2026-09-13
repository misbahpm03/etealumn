import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "@/lib/errors";
import type { WorkExperienceRepository } from "@/repositories/work-experience.repository";
import type {
  UpdateWorkExperienceInput,
  Uuid,
  WorkExperience,
  WorkExperienceInput,
} from "@/types";
import { unwrapQuery } from "./errors";

const COLUMNS =
  "id,user_id,company,designation,location,start_date,end_date,is_current,description,display_order,created_at,updated_at" as const;

interface Row {
  id: string;
  user_id: string;
  company: string;
  designation: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

function toEntity(row: Row): WorkExperience {
  return {
    id: row.id,
    userId: row.user_id,
    company: row.company,
    designation: row.designation,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    description: row.description,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDb(
  input: WorkExperienceInput | UpdateWorkExperienceInput,
): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (input.company !== undefined) db.company = input.company;
  if (input.designation !== undefined) db.designation = input.designation;
  if (input.location !== undefined) db.location = input.location;
  if (input.startDate !== undefined) db.start_date = input.startDate;
  if (input.endDate !== undefined) db.end_date = input.endDate;
  if (input.isCurrent !== undefined) db.is_current = input.isCurrent;
  if (input.description !== undefined) db.description = input.description;
  if (input.displayOrder !== undefined) db.display_order = input.displayOrder;
  return db;
}

export class SupabaseWorkExperienceRepository
  implements WorkExperienceRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async listByUserId(userId: Uuid): Promise<ReadonlyArray<WorkExperience>> {
    const rows = (await unwrapQuery(
      this.client
        .from("work_experience")
        .select(COLUMNS)
        .eq("user_id", userId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true }),
    )) as Row[];
    return rows.map(toEntity);
  }

  async findById(id: Uuid, userId: Uuid): Promise<WorkExperience | null> {
    const row = (await unwrapQuery(
      this.client
        .from("work_experience")
        .select(COLUMNS)
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle(),
    )) as Row | null;
    return row ? toEntity(row) : null;
  }

  async create(
    userId: Uuid,
    input: WorkExperienceInput,
  ): Promise<WorkExperience> {
    const row = (await unwrapQuery(
      this.client
        .from("work_experience")
        .insert({ user_id: userId, ...toDb(input) })
        .select(COLUMNS)
        .single(),
    )) as Row;
    return toEntity(row);
  }

  async update(
    id: Uuid,
    userId: Uuid,
    input: UpdateWorkExperienceInput,
  ): Promise<WorkExperience> {
    const db = toDb(input);
    if (Object.keys(db).length === 0) {
      const current = await this.findById(id, userId);
      if (!current) throw new NotFoundError("Work experience");
      return current;
    }
    const row = (await unwrapQuery(
      this.client
        .from("work_experience")
        .update(db)
        .eq("id", id)
        .eq("user_id", userId)
        .select(COLUMNS)
        .maybeSingle(),
    )) as Row | null;
    if (!row) throw new NotFoundError("Work experience");
    return toEntity(row);
  }

  async remove(id: Uuid, userId: Uuid): Promise<void> {
    const deleted = (await unwrapQuery(
      this.client
        .from("work_experience")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .select("id"),
    )) as Array<{ id: string }>;
    if (deleted.length === 0) throw new NotFoundError("Work experience");
  }
}
