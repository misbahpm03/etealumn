import type {
  PostgrestError,
  SupabaseClient,
} from "@supabase/supabase-js";
import type { PublicProfileRepository } from "@/repositories/public-profile.repository";
import type {
  DirectorySearchQuery,
  PublicEducationItem,
  PublicWorkItem,
  SafeMemberProfile,
  SafePublicProfile,
  Uuid,
} from "@/types";
import { toAppError, unwrapQuery } from "./errors";

/**
 * Explicit view columns — never `*`. `search_name` is filter-only (used by
 * search, never selected into DTOs); `user_id` and `profile_photo_path`
 * do not exist on the public views at all (Phase 8 migration).
 */
const PUBLIC_COLUMNS =
  "slug,role,full_name,display_name,has_photo,bio,location,email,phone,website_url,linkedin_url,facebook_url,github_url,current_company,current_designation,work_location,career_summary,graduation_year,batch_id,batch_name,batch_admission_year,batch_graduation_year" as const;

const MEMBER_COLUMNS =
  "user_id,full_name,display_name,profile_photo_path,bio,location,website_url,linkedin_url,facebook_url,github_url" as const;

const WORK_COLUMNS =
  "company,designation,location,start_date,end_date,is_current,description,display_order" as const;

const EDUCATION_COLUMNS =
  "institution,degree,field_of_study,start_year,end_year,description,display_order" as const;

interface PublicRow {
  slug: string;
  role: "ALUMNI" | "STUDENT" | "FACULTY";
  full_name: string;
  display_name: string | null;
  has_photo: boolean;
  bio: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  github_url: string | null;
  current_company: string | null;
  current_designation: string | null;
  work_location: string | null;
  career_summary: string | null;
  graduation_year: number | null;
  batch_id: string | null;
  batch_name: string | null;
  batch_admission_year: number | null;
  batch_graduation_year: number | null;
}

interface MemberRow {
  user_id: string;
  full_name: string;
  display_name: string | null;
  profile_photo_path: string | null;
  bio: string | null;
  location: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  github_url: string | null;
}

interface WorkRow {
  company: string;
  designation: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  display_order: number;
}

interface EducationRow {
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  description: string | null;
  display_order: number;
}

function toSafeProfile(row: PublicRow): SafePublicProfile {
  return {
    slug: row.slug,
    role: row.role,
    fullName: row.full_name,
    displayName: row.display_name,
    hasPhoto: row.has_photo,
    bio: row.bio,
    location: row.location,
    email: row.email,
    phone: row.phone,
    websiteUrl: row.website_url,
    linkedinUrl: row.linkedin_url,
    facebookUrl: row.facebook_url,
    githubUrl: row.github_url,
    currentCompany: row.current_company,
    currentDesignation: row.current_designation,
    workLocation: row.work_location,
    careerSummary: row.career_summary,
    graduationYear: row.graduation_year,
    batchId: row.batch_id,
    batchName: row.batch_name,
    batchAdmissionYear: row.batch_admission_year,
    batchGraduationYear: row.batch_graduation_year,
  };
}

function toMemberProfile(row: MemberRow): SafeMemberProfile {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    displayName: row.display_name,
    profilePhotoPath: row.profile_photo_path,
    bio: row.bio,
    location: row.location,
    websiteUrl: row.website_url,
    linkedinUrl: row.linkedin_url,
    facebookUrl: row.facebook_url,
    githubUrl: row.github_url,
  };
}

function toWorkItem(row: WorkRow): PublicWorkItem {
  return {
    company: row.company,
    designation: row.designation,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    description: row.description,
    displayOrder: row.display_order,
  };
}

function toEducationItem(row: EducationRow): PublicEducationItem {
  return {
    institution: row.institution,
    degree: row.degree,
    fieldOfStudy: row.field_of_study,
    startYear: row.start_year,
    endYear: row.end_year,
    description: row.description,
    displayOrder: row.display_order,
  };
}

/**
 * Escape LIKE metacharacters so user input matches literally. Values stay
 * parameterized (postgrest-js URL-encodes them; no SQL string building).
 * `*` is intentionally left for PostgREST's native partial-match handling.
 */
function escapeLikeLiteral(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

async function unwrapCounted<T>(
  query: PromiseLike<{ data: T; count: number | null; error: PostgrestError | null }>,
): Promise<{ rows: T; total: number }> {
  const result = await query;
  if (result.error) throw toAppError(result.error);
  return { rows: result.data, total: result.count ?? 0 };
}

export class SupabasePublicProfileRepository
  implements PublicProfileRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async getPublicProfileBySlug(slug: string): Promise<SafePublicProfile | null> {
    const row = (await unwrapQuery(
      this.client
        .from("profiles_public")
        .select(PUBLIC_COLUMNS)
        .eq("slug", slug)
        .maybeSingle(),
    )) as PublicRow | null;
    return row ? toSafeProfile(row) : null;
  }

  async searchPublicProfiles(
    query: DirectorySearchQuery,
  ): Promise<{ rows: SafePublicProfile[]; total: number }> {
    let builder = this.client
      .from("profiles_public")
      .select(PUBLIC_COLUMNS, { count: "exact" });
    // Every filter below applies INSIDE the database on the safe view.
    // Column names are constants; values are service-validated + parameterized.
    if (query.text !== null) {
      builder = builder.ilike(
        "search_name",
        `%${escapeLikeLiteral(query.text)}%`,
      );
    }
    if (query.batchId !== null) {
      builder = builder.eq("batch_id", query.batchId);
    }
    if (query.graduationYear !== null) {
      builder = builder.eq("graduation_year", query.graduationYear);
    }
    if (query.company !== null) {
      builder = builder.ilike(
        "current_company",
        `%${escapeLikeLiteral(query.company)}%`,
      );
    }
    if (query.designation !== null) {
      builder = builder.ilike(
        "current_designation",
        `%${escapeLikeLiteral(query.designation)}%`,
      );
    }
    if (query.location !== null) {
      builder = builder.ilike(
        "location",
        `%${escapeLikeLiteral(query.location)}%`,
      );
    }
    if (query.role !== null) {
      builder = builder.eq("role", query.role);
    }
    const { rows, total } = await unwrapCounted(
      builder
        .order("full_name", { ascending: true })
        .order("slug", { ascending: true })
        .range(query.offset, query.offset + query.limit - 1),
    );
    return {
      rows: (rows as PublicRow[]).map(toSafeProfile),
      total,
    };
  }

  async listPublicWorkExperience(
    slug: string,
  ): Promise<ReadonlyArray<PublicWorkItem>> {
    const rows = (await unwrapQuery(
      this.client
        .from("work_experience_public")
        .select(WORK_COLUMNS)
        .eq("slug", slug)
        .order("display_order", { ascending: true })
        .order("company", { ascending: true }),
    )) as WorkRow[];
    return rows.map(toWorkItem);
  }

  async listPublicEducation(
    slug: string,
  ): Promise<ReadonlyArray<PublicEducationItem>> {
    const rows = (await unwrapQuery(
      this.client
        .from("education_public")
        .select(EDUCATION_COLUMNS)
        .eq("slug", slug)
        .order("display_order", { ascending: true })
        .order("institution", { ascending: true }),
    )) as EducationRow[];
    return rows.map(toEducationItem);
  }

  async getMemberProfile(userId: Uuid): Promise<SafeMemberProfile | null> {
    const row = (await unwrapQuery(
      this.client
        .from("profiles_member")
        .select(MEMBER_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle(),
    )) as MemberRow | null;
    return row ? toMemberProfile(row) : null;
  }
}
