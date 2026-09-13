"use server";

import { revalidatePath } from "next/cache";
import {
  createProfileService,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import { ValidationError, isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import type { SessionUser } from "@/types";
import { validateRecordId } from "@/validations/profile";

/**
 * Profile server actions — thin composition over ProfileService. Every
 * action resolves the caller via `requireActiveUser()` (server session,
 * never client input) and parses FormData into typed values; the SERVICE
 * owns validation, ownership, role gating, and auditing. Results carry
 * user-safe messages only.
 */

export interface ProfileActionSuccess {
  ok: true;
}

export interface ProfileActionFailure {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
}

export type ProfileActionResult =
  | ProfileActionSuccess
  | ProfileActionFailure;

function toFailure(error: unknown, fallback: string): ProfileActionFailure {
  if (error instanceof ValidationError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      if (!(issue.field in fieldErrors)) {
        fieldErrors[issue.field] = issue.message;
      }
    }
    return {
      ok: false,
      error:
        error.issues.length > 0
          ? "Please fix the highlighted fields."
          : error.message,
      fieldErrors,
    };
  }
  if (isAppError(error)) {
    return { ok: false, error: error.message };
  }
  console.error("[profile] unexpected error", error);
  return { ok: false, error: fallback };
}

// ------------------------------------------------------- form parsing ---
type ParsedInt = { value: number | null; valid: boolean };

function text(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function checkbox(value: FormDataEntryValue | null): boolean {
  return value === "on";
}

/** Empty/absent → null (clear or default); malformed → valid:false. */
function intField(value: FormDataEntryValue | null): ParsedInt {
  if (value === null) return { value: null, valid: true };
  const raw = String(value).trim();
  if (raw === "") return { value: null, valid: true };
  if (!/^-?\d+$/.test(raw)) return { value: null, valid: false };
  return { value: Number(raw), valid: true };
}

function pushIntIssue(
  issues: Array<{ field: string; message: string }>,
  field: string,
  parsed: ParsedInt,
): void {
  if (!parsed.valid) {
    issues.push({ field, message: "Enter a whole number." });
  }
}

function revalidateProfilePages(): void {
  revalidatePath(routes.portal.profile);
  revalidatePath(routes.portal.profileEdit);
  revalidatePath(routes.portal.profileAcademic);
  revalidatePath(routes.portal.profileCareer);
  revalidatePath(routes.portal.onboarding);
}

async function serviceFor(user: SessionUser) {
  return createProfileService(user);
}

// -------------------------------------------------------------- profile ---
export async function updateProfileAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const service = await serviceFor(await requireActiveUser());
    await service.updateCurrentProfile({
      fullName: text(formData.get("fullName")) ?? "",
      displayName: text(formData.get("displayName")),
      bio: text(formData.get("bio")),
      phone: text(formData.get("phone")),
      location: text(formData.get("location")),
      websiteUrl: text(formData.get("websiteUrl")),
      linkedinUrl: text(formData.get("linkedinUrl")),
      facebookUrl: text(formData.get("facebookUrl")),
      githubUrl: text(formData.get("githubUrl")),
      profileVisibility: (text(formData.get("profileVisibility")) ?? undefined) as
        | "PUBLIC"
        | "STUDENT_ONLY"
        | "FACULTY_ONLY"
        | "PRIVATE"
        | undefined,
    });
    revalidateProfilePages();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "Could not save the profile. Please try again.");
  }
}

export async function updatePrivacyAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const service = await serviceFor(await requireActiveUser());
    await service.updateCurrentPrivacy({
      showEmail: checkbox(formData.get("showEmail")),
      showPhone: checkbox(formData.get("showPhone")),
      showLocation: checkbox(formData.get("showLocation")),
      showBio: checkbox(formData.get("showBio")),
      showCareer: checkbox(formData.get("showCareer")),
      showEducation: checkbox(formData.get("showEducation")),
      showSocialLinks: checkbox(formData.get("showSocialLinks")),
      showProfilePublicly: checkbox(formData.get("showProfilePublicly")),
    });
    revalidateProfilePages();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "Could not save privacy settings. Please try again.");
  }
}

// ------------------------------------------------------- student/alumni ---
export async function saveStudentProfileAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const enrollmentYear = intField(formData.get("enrollmentYear"));
    const expectedGraduationYear = intField(
      formData.get("expectedGraduationYear"),
    );
    const currentSemester = intField(formData.get("currentSemester"));
    const parseIssues: Array<{ field: string; message: string }> = [];
    pushIntIssue(parseIssues, "enrollmentYear", enrollmentYear);
    pushIntIssue(
      parseIssues,
      "expectedGraduationYear",
      expectedGraduationYear,
    );
    pushIntIssue(parseIssues, "currentSemester", currentSemester);
    if (parseIssues.length > 0) {
      return toFailure(new ValidationError(parseIssues), "Invalid input.");
    }
    const service = await serviceFor(await requireActiveUser());
    await service.saveCurrentStudentProfile({
      batchId: text(formData.get("batchId")),
      studentId: text(formData.get("studentId")) ?? undefined,
      enrollmentYear: enrollmentYear.value,
      expectedGraduationYear: expectedGraduationYear.value,
      currentSemester: currentSemester.value,
      department: text(formData.get("department")),
      academicStatus: text(formData.get("academicStatus")),
    });
    revalidateProfilePages();
    return { ok: true };
  } catch (error) {
    return toFailure(
      error,
      "Could not save the student profile. Please try again.",
    );
  }
}

export async function saveAlumniProfileAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const graduationYear = intField(formData.get("graduationYear"));
    if (!graduationYear.valid) {
      return toFailure(
        new ValidationError([
          { field: "graduationYear", message: "Enter a whole number." },
        ]),
        "Invalid input.",
      );
    }
    const service = await serviceFor(await requireActiveUser());
    await service.saveCurrentAlumniProfile({
      batchId: text(formData.get("batchId")),
      graduationYear: graduationYear.value,
      currentCompany: text(formData.get("currentCompany")),
      currentDesignation: text(formData.get("currentDesignation")),
      currentLocation: text(formData.get("currentLocation")),
      careerSummary: text(formData.get("careerSummary")),
      availableForMentoring: checkbox(formData.get("availableForMentoring")),
    });
    revalidateProfilePages();
    return { ok: true };
  } catch (error) {
    return toFailure(
      error,
      "Could not save the alumni profile. Please try again.",
    );
  }
}

// ----------------------------------------------------------------- work ---
export async function addWorkExperienceAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  return saveWorkExperience(null, formData);
}

export async function updateWorkExperienceAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  const id = text(formData.get("id"));
  if (validateRecordId(id).length > 0) {
    return { ok: false, error: "Invalid request." };
  }
  return saveWorkExperience(id as string, formData);
}

async function saveWorkExperience(
  id: string | null,
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const displayOrder = intField(formData.get("displayOrder"));
    if (!displayOrder.valid) {
      return toFailure(
        new ValidationError([
          { field: "displayOrder", message: "Enter a whole number." },
        ]),
        "Invalid input.",
      );
    }
    const service = await serviceFor(await requireActiveUser());
    const input = {
      company: text(formData.get("company")) ?? "",
      designation: text(formData.get("designation")),
      location: text(formData.get("location")),
      startDate: text(formData.get("startDate")),
      endDate: text(formData.get("endDate")),
      isCurrent: checkbox(formData.get("isCurrent")),
      description: text(formData.get("description")),
      // Null (blank) means "leave default/unchanged", not SQL NULL —
      // display_order is NOT NULL, so omit rather than null.
      displayOrder: displayOrder.value ?? undefined,
    };
    if (id) {
      await service.updateWorkExperience(id, input);
    } else {
      await service.addWorkExperience(input);
    }
    revalidateProfilePages();
    return { ok: true };
  } catch (error) {
    return toFailure(
      error,
      "Could not save the work entry. Please try again.",
    );
  }
}

export async function removeWorkExperienceAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const id = text(formData.get("id"));
    if (validateRecordId(id).length > 0) {
      return { ok: false, error: "Invalid request." };
    }
    const service = await serviceFor(await requireActiveUser());
    await service.removeWorkExperience(id as string);
    revalidateProfilePages();
    return { ok: true };
  } catch (error) {
    return toFailure(
      error,
      "Could not remove the work entry. Please try again.",
    );
  }
}

// ------------------------------------------------------------ education ---
export async function addEducationAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  return saveEducation(null, formData);
}

export async function updateEducationAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  const id = text(formData.get("id"));
  if (validateRecordId(id).length > 0) {
    return { ok: false, error: "Invalid request." };
  }
  return saveEducation(id as string, formData);
}

async function saveEducation(
  id: string | null,
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const startYear = intField(formData.get("startYear"));
    const endYear = intField(formData.get("endYear"));
    const displayOrder = intField(formData.get("displayOrder"));
    const parseIssues: Array<{ field: string; message: string }> = [];
    pushIntIssue(parseIssues, "startYear", startYear);
    pushIntIssue(parseIssues, "endYear", endYear);
    pushIntIssue(parseIssues, "displayOrder", displayOrder);
    if (parseIssues.length > 0) {
      return toFailure(new ValidationError(parseIssues), "Invalid input.");
    }
    const service = await serviceFor(await requireActiveUser());
    const input = {
      institution: text(formData.get("institution")) ?? "",
      degree: text(formData.get("degree")),
      fieldOfStudy: text(formData.get("fieldOfStudy")),
      startYear: startYear.value,
      endYear: endYear.value,
      description: text(formData.get("description")),
      displayOrder: displayOrder.value ?? undefined,
    };
    if (id) {
      await service.updateEducation(id, input);
    } else {
      await service.addEducation(input);
    }
    revalidateProfilePages();
    return { ok: true };
  } catch (error) {
    return toFailure(
      error,
      "Could not save the education entry. Please try again.",
    );
  }
}

export async function removeEducationAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const id = text(formData.get("id"));
    if (validateRecordId(id).length > 0) {
      return { ok: false, error: "Invalid request." };
    }
    const service = await serviceFor(await requireActiveUser());
    await service.removeEducation(id as string);
    revalidateProfilePages();
    return { ok: true };
  } catch (error) {
    return toFailure(
      error,
      "Could not remove the education entry. Please try again.",
    );
  }
}

// ---------------------------------------------------------------- photo ---
export async function uploadPhotoAction(
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return toFailure(
        new ValidationError([{ field: "photo", message: "Choose an image." }]),
        "Invalid input.",
      );
    }
    const service = await serviceFor(await requireActiveUser());
    await service.uploadProfilePhoto({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      data: new Uint8Array(await file.arrayBuffer()),
    });
    revalidateProfilePages();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "Could not upload the photo. Please try again.");
  }
}

export async function removePhotoAction(): Promise<ProfileActionResult> {
  try {
    const service = await serviceFor(await requireActiveUser());
    await service.removeProfilePhoto();
    revalidateProfilePages();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "Could not remove the photo. Please try again.");
  }
}
