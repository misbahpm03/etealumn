import type { IsoDateString, Uuid } from "./common";
import type { DocumentVisibility } from "./document";
import type { UserRole, UserStatus } from "./user";

/** Full member profile (raw table — owner/admin reads only, never public). */
export interface Profile {
  id: Uuid;
  userId: Uuid;
  fullName: string;
  displayName: string | null;
  profilePhotoPath: string | null;
  bio: string | null;
  phone: string | null;
  location: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  githubUrl: string | null;
  profileVisibility: DocumentVisibility;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface UpdateProfileInput {
  fullName?: string;
  displayName?: string | null;
  profilePhotoPath?: string | null;
  bio?: string | null;
  phone?: string | null;
  location?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  facebookUrl?: string | null;
  githubUrl?: string | null;
  profileVisibility?: DocumentVisibility;
}

/** Per-field privacy flags (owner/admin only — never exposed cross-user). */
export interface ProfilePrivacy {
  id: Uuid;
  userId: Uuid;
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  showBio: boolean;
  showCareer: boolean;
  showEducation: boolean;
  showSocialLinks: boolean;
  showProfilePublicly: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface UpdatePrivacyInput {
  showEmail?: boolean;
  showPhone?: boolean;
  showLocation?: boolean;
  showBio?: boolean;
  showCareer?: boolean;
  showEducation?: boolean;
  showSocialLinks?: boolean;
  showProfilePublicly?: boolean;
}

/** Student academic identity. Verified fields are server-side managed. */
export interface StudentProfile {
  id: Uuid;
  userId: Uuid;
  batchId: Uuid | null;
  studentId: string;
  enrollmentYear: number | null;
  expectedGraduationYear: number | null;
  currentSemester: number | null;
  department: string | null;
  academicStatus: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** Creation requires `studentId` (NOT NULL, UNIQUE in the schema). */
export interface CreateStudentProfileInput {
  batchId?: Uuid | null;
  studentId: string;
  enrollmentYear?: number | null;
  expectedGraduationYear?: number | null;
  currentSemester?: number | null;
  department?: string | null;
  academicStatus?: string | null;
}

export type UpdateStudentProfileInput = Partial<CreateStudentProfileInput>;

/** Alumni academic identity. Verified fields are server-side managed. */
export interface AlumniProfile {
  id: Uuid;
  userId: Uuid;
  batchId: Uuid | null;
  graduationYear: number | null;
  currentCompany: string | null;
  currentDesignation: string | null;
  currentLocation: string | null;
  careerSummary: string | null;
  availableForMentoring: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface AlumniProfileInput {
  batchId?: Uuid | null;
  graduationYear?: number | null;
  currentCompany?: string | null;
  currentDesignation?: string | null;
  currentLocation?: string | null;
  careerSummary?: string | null;
  availableForMentoring?: boolean;
}

/** One employment entry. `userId` is always server-resolved, never input. */
export interface WorkExperience {
  id: Uuid;
  userId: Uuid;
  company: string;
  designation: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  displayOrder: number;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface WorkExperienceInput {
  company: string;
  designation?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string | null;
  displayOrder?: number;
}

export type UpdateWorkExperienceInput = Partial<WorkExperienceInput>;

/** One education entry. `userId` is always server-resolved, never input. */
export interface Education {
  id: Uuid;
  userId: Uuid;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
  description: string | null;
  displayOrder: number;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface EducationInput {
  institution: string;
  degree?: string | null;
  fieldOfStudy?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  description?: string | null;
  displayOrder?: number;
}

export type UpdateEducationInput = Partial<EducationInput>;

/** Batch reference data (publicly readable, admin-managed). */
export interface Batch {
  id: Uuid;
  name: string;
  batchNumber: number | null;
  admissionYear: number | null;
  graduationYear: number | null;
  description: string | null;
  coverImagePath: string | null;
  status: "ACTIVE" | "ARCHIVED";
}

/**
 * Safe public projection (`profiles_public` view). Email, phone, and
 * flag-gated fields are absent by construction — never add raw columns.
 */
export interface SafePublicProfile {
  userId: Uuid;
  fullName: string;
  displayName: string | null;
  profilePhotoPath: string | null;
  bio: string | null;
  location: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  githubUrl: string | null;
}

/** Safe member projection (`profiles_member` view) — same shape, wider rows. */
export type SafeMemberProfile = SafePublicProfile;

/** Privacy-flag names for audit metadata (names only, never values). */
export const PRIVACY_FLAG_NAMES = [
  "showEmail",
  "showPhone",
  "showLocation",
  "showBio",
  "showCareer",
  "showEducation",
  "showSocialLinks",
  "showProfilePublicly",
] as const;

export type PrivacyFlagName = (typeof PRIVACY_FLAG_NAMES)[number];

/**
 * Derived onboarding checklist — computed from existing records on every
 * read. No stored `is_onboarded` flag exists by design (single source of
 * truth, impossible to desync).
 */
export interface OnboardingState {
  role: UserRole;
  status: UserStatus;
  hasProfile: boolean;
  hasCustomName: boolean;
  hasPhoto: boolean;
  hasPrivacy: boolean;
  /** Role profiles only apply to STUDENT/ALUMNI; otherwise not required. */
  roleProfileRequired: boolean;
  hasRoleProfile: boolean;
  workCount: number;
  educationCount: number;
  /** True when every required step is done (career entries optional). */
  complete: boolean;
}
