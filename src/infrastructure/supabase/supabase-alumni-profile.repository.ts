import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "@/lib/errors";
import type { AlumniProfileRepository } from "@/repositories/alumni-profile.repository";
import type {
  AlumniProfile,
  AlumniProfileInput,
  Uuid,
} from "@/types";
import { unwrapQuery } from "./errors";

const COLUMNS =
  "id,user_id,batch_id,graduation_year,current_company,current_designation,current_location,career_summary,available_for_mentoring,created_at,updated_at" as const;

interface Row {
  id: string;
  user_id: string;
  batch_id: string | null;
  graduation_year: number | null;
  current_company: string | null;
  current_designation: string | null;
  current_location: string | null;
  career_summary: string | null;
  available_for_mentoring: boolean;
  created_at: string;
  updated_at: string;
}

function toEntity(row: Row): AlumniProfile {
  return {
    id: row.id,
    userId: row.user_id,
    batchId: row.batch_id,
    graduationYear: row.graduation_year,
    currentCompany: row.current_company,
    currentDesignation: row.current_designation,
    currentLocation: row.current_location,
    careerSummary: row.career_summary,
    availableForMentoring: row.available_for_mentoring,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDb(input: AlumniProfileInput): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (input.batchId !== undefined) db.batch_id = input.batchId;
  if (input.graduationYear !== undefined)
    db.graduation_year = input.graduationYear;
  if (input.currentCompany !== undefined)
    db.current_company = input.currentCompany;
  if (input.currentDesignation !== undefined)
    db.current_designation = input.currentDesignation;
  if (input.currentLocation !== undefined)
    db.current_location = input.currentLocation;
  if (input.careerSummary !== undefined)
    db.career_summary = input.careerSummary;
  if (input.availableForMentoring !== undefined)
    db.available_for_mentoring = input.availableForMentoring;
  return db;
}

export class SupabaseAlumniProfileRepository
  implements AlumniProfileRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: Uuid): Promise<AlumniProfile | null> {
    const row = (await unwrapQuery(
      this.client
        .from("alumni_profiles")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle(),
    )) as Row | null;
    return row ? toEntity(row) : null;
  }

  async create(
    input: { userId: Uuid } & AlumniProfileInput,
  ): Promise<AlumniProfile> {
    const row = (await unwrapQuery(
      this.client
        .from("alumni_profiles")
        .insert({ user_id: input.userId, ...toDb(input) })
        .select(COLUMNS)
        .single(),
    )) as Row;
    return toEntity(row);
  }

  async update(
    userId: Uuid,
    input: AlumniProfileInput,
  ): Promise<AlumniProfile> {
    const db = toDb(input);
    if (Object.keys(db).length === 0) {
      const current = await this.findByUserId(userId);
      if (!current) throw new NotFoundError("Alumni profile");
      return current;
    }
    const row = (await unwrapQuery(
      this.client
        .from("alumni_profiles")
        .update(db)
        .eq("user_id", userId)
        .select(COLUMNS)
        .maybeSingle(),
    )) as Row | null;
    if (!row) throw new NotFoundError("Alumni profile");
    return toEntity(row);
  }
}
