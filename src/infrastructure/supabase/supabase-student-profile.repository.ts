import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "@/lib/errors";
import type { StudentProfileRepository } from "@/repositories/student-profile.repository";
import type {
  CreateStudentProfileInput,
  StudentProfile,
  UpdateStudentProfileInput,
  Uuid,
} from "@/types";
import { unwrapQuery } from "./errors";

const COLUMNS =
  "id,user_id,batch_id,student_id,enrollment_year,expected_graduation_year,current_semester,department,academic_status,created_at,updated_at" as const;

interface Row {
  id: string;
  user_id: string;
  batch_id: string | null;
  student_id: string;
  enrollment_year: number | null;
  expected_graduation_year: number | null;
  current_semester: number | null;
  department: string | null;
  academic_status: string | null;
  created_at: string;
  updated_at: string;
}

function toEntity(row: Row): StudentProfile {
  return {
    id: row.id,
    userId: row.user_id,
    batchId: row.batch_id,
    studentId: row.student_id,
    enrollmentYear: row.enrollment_year,
    expectedGraduationYear: row.expected_graduation_year,
    currentSemester: row.current_semester,
    department: row.department,
    academicStatus: row.academic_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDb(
  input: CreateStudentProfileInput | UpdateStudentProfileInput,
): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (input.batchId !== undefined) db.batch_id = input.batchId;
  if (input.studentId !== undefined) db.student_id = input.studentId;
  if (input.enrollmentYear !== undefined)
    db.enrollment_year = input.enrollmentYear;
  if (input.expectedGraduationYear !== undefined)
    db.expected_graduation_year = input.expectedGraduationYear;
  if (input.currentSemester !== undefined)
    db.current_semester = input.currentSemester;
  if (input.department !== undefined) db.department = input.department;
  if (input.academicStatus !== undefined)
    db.academic_status = input.academicStatus;
  return db;
}

export class SupabaseStudentProfileRepository
  implements StudentProfileRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: Uuid): Promise<StudentProfile | null> {
    const row = (await unwrapQuery(
      this.client
        .from("student_profiles")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle(),
    )) as Row | null;
    return row ? toEntity(row) : null;
  }

  async create(
    input: { userId: Uuid } & CreateStudentProfileInput,
  ): Promise<StudentProfile> {
    const row = (await unwrapQuery(
      this.client
        .from("student_profiles")
        .insert({ user_id: input.userId, ...toDb(input) })
        .select(COLUMNS)
        .single(),
    )) as Row;
    return toEntity(row);
  }

  async update(
    userId: Uuid,
    input: UpdateStudentProfileInput,
  ): Promise<StudentProfile> {
    const db = toDb(input);
    if (Object.keys(db).length === 0) {
      const current = await this.findByUserId(userId);
      if (!current) throw new NotFoundError("Student profile");
      return current;
    }
    const row = (await unwrapQuery(
      this.client
        .from("student_profiles")
        .update(db)
        .eq("user_id", userId)
        .select(COLUMNS)
        .maybeSingle(),
    )) as Row | null;
    if (!row) throw new NotFoundError("Student profile");
    return toEntity(row);
  }
}
