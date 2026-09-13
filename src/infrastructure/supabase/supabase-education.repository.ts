import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "@/lib/errors";
import type { EducationRepository } from "@/repositories/education.repository";
import type {
  Education,
  EducationInput,
  UpdateEducationInput,
  Uuid,
} from "@/types";
import { unwrapQuery } from "./errors";

const COLUMNS =
  "id,user_id,institution,degree,field_of_study,start_year,end_year,description,display_order,created_at,updated_at" as const;

interface Row {
  id: string;
  user_id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

function toEntity(row: Row): Education {
  return {
    id: row.id,
    userId: row.user_id,
    institution: row.institution,
    degree: row.degree,
    fieldOfStudy: row.field_of_study,
    startYear: row.start_year,
    endYear: row.end_year,
    description: row.description,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDb(
  input: EducationInput | UpdateEducationInput,
): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (input.institution !== undefined) db.institution = input.institution;
  if (input.degree !== undefined) db.degree = input.degree;
  if (input.fieldOfStudy !== undefined) db.field_of_study = input.fieldOfStudy;
  if (input.startYear !== undefined) db.start_year = input.startYear;
  if (input.endYear !== undefined) db.end_year = input.endYear;
  if (input.description !== undefined) db.description = input.description;
  if (input.displayOrder !== undefined) db.display_order = input.displayOrder;
  return db;
}

export class SupabaseEducationRepository implements EducationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByUserId(userId: Uuid): Promise<ReadonlyArray<Education>> {
    const rows = (await unwrapQuery(
      this.client
        .from("education")
        .select(COLUMNS)
        .eq("user_id", userId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true }),
    )) as Row[];
    return rows.map(toEntity);
  }

  async findById(id: Uuid, userId: Uuid): Promise<Education | null> {
    const row = (await unwrapQuery(
      this.client
        .from("education")
        .select(COLUMNS)
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle(),
    )) as Row | null;
    return row ? toEntity(row) : null;
  }

  async create(userId: Uuid, input: EducationInput): Promise<Education> {
    const row = (await unwrapQuery(
      this.client
        .from("education")
        .insert({ user_id: userId, ...toDb(input) })
        .select(COLUMNS)
        .single(),
    )) as Row;
    return toEntity(row);
  }

  async update(
    id: Uuid,
    userId: Uuid,
    input: UpdateEducationInput,
  ): Promise<Education> {
    const db = toDb(input);
    if (Object.keys(db).length === 0) {
      const current = await this.findById(id, userId);
      if (!current) throw new NotFoundError("Education");
      return current;
    }
    const row = (await unwrapQuery(
      this.client
        .from("education")
        .update(db)
        .eq("id", id)
        .eq("user_id", userId)
        .select(COLUMNS)
        .maybeSingle(),
    )) as Row | null;
    if (!row) throw new NotFoundError("Education");
    return toEntity(row);
  }

  async remove(id: Uuid, userId: Uuid): Promise<void> {
    const deleted = (await unwrapQuery(
      this.client
        .from("education")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .select("id"),
    )) as Array<{ id: string }>;
    if (deleted.length === 0) throw new NotFoundError("Education");
  }
}
