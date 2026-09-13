import {
  isNonEmptyString,
  isOneOf,
  isUuid,
  type ValidationIssue,
} from "./common";

/**
 * Pure profile validators. Isomorphic (no Node APIs) so server actions and
 * services share the same rules; the SERVICE always validates the final
 * (merged) object — never trust a partial patch alone for cross-field rules
 * like date order. Length caps are app-level abuse prevention (the schema
 * uses unbounded `text`); year/semester ranges mirror CHECK constraints.
 */

export const PROFILE_LIMITS = {
  fullName: 200,
  displayName: 100,
  bio: 5000,
  phone: 32,
  location: 200,
  url: 2048,
  studentId: 50,
  department: 200,
  academicStatus: 100,
  company: 200,
  designation: 200,
  careerSummary: 5000,
  description: 5000,
  institution: 200,
  degree: 200,
  fieldOfStudy: 200,
  yearMin: 1900,
  yearMax: 2100,
  semesterMin: 1,
  semesterMax: 20,
  displayOrderMax: 1000000,
} as const;

export const PROFILE_VISIBILITIES = [
  "PUBLIC",
  "STUDENT_ONLY",
  "FACULTY_ONLY",
  "PRIVATE",
] as const;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Strict calendar date (`2026-02-30` fails — Date normalization caught). */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > PROFILE_LIMITS.url)
    return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isYear(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= PROFILE_LIMITS.yearMin &&
    value <= PROFILE_LIMITS.yearMax
  );
}

function checkText(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
  max: number,
  opts: { required?: boolean; allowNull?: boolean } = {},
): void {
  if (value === undefined) return;
  if (value === null) {
    if (!opts.allowNull) issues.push({ field, message: "Required." });
    return;
  }
  if (typeof value !== "string") {
    issues.push({ field, message: "Must be text." });
    return;
  }
  if (opts.required && value.trim().length === 0) {
    issues.push({ field, message: "Required." });
    return;
  }
  if (value.length > max) {
    issues.push({ field, message: `Keep under ${max} characters.` });
    return;
  }
  if (CONTROL_CHARS.test(value)) {
    issues.push({ field, message: "Contains invalid characters." });
  }
}

function checkYear(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
): void {
  if (value === undefined || value === null) return;
  if (!isYear(value)) {
    issues.push({
      field,
      message: `Enter a year between ${PROFILE_LIMITS.yearMin} and ${PROFILE_LIMITS.yearMax}.`,
    });
  }
}

function checkYearOrder(
  issues: ValidationIssue[],
  startField: string,
  start: unknown,
  endField: string,
  end: unknown,
): void {
  if (isYear(start) && isYear(end) && end < start) {
    issues.push({ field: endField, message: "Must not be before the start." });
  }
}

function checkDate(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
): void {
  if (value === undefined || value === null) return;
  if (!isDateOnly(value)) {
    issues.push({ field, message: "Enter a valid date (YYYY-MM-DD)." });
  }
}

function checkDisplayOrder(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
): void {
  if (value === undefined || value === null) return;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > PROFILE_LIMITS.displayOrderMax
  ) {
    issues.push({ field, message: "Enter a number from 0 up." });
  }
}

function checkBoolean(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
): void {
  if (value === undefined) return;
  if (typeof value !== "boolean") {
    issues.push({ field, message: "Must be true or false." });
  }
}

function checkBatchId(
  issues: ValidationIssue[],
  field: string,
  value: unknown,
): void {
  if (value === undefined || value === null) return;
  if (!isUuid(value)) {
    issues.push({ field, message: "Select a valid batch." });
  }
}

export function validateUpdateProfile(input: {
  fullName?: unknown;
  displayName?: unknown;
  bio?: unknown;
  phone?: unknown;
  location?: unknown;
  websiteUrl?: unknown;
  linkedinUrl?: unknown;
  facebookUrl?: unknown;
  githubUrl?: unknown;
  profileVisibility?: unknown;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // full_name is NOT NULL: present values must be non-empty; null rejected.
  checkText(issues, "fullName", input.fullName, PROFILE_LIMITS.fullName, {
    required: true,
  });
  checkText(issues, "displayName", input.displayName, PROFILE_LIMITS.displayName, {
    allowNull: true,
  });
  checkText(issues, "bio", input.bio, PROFILE_LIMITS.bio, { allowNull: true });
  checkText(issues, "phone", input.phone, PROFILE_LIMITS.phone, {
    allowNull: true,
  });
  checkText(issues, "location", input.location, PROFILE_LIMITS.location, {
    allowNull: true,
  });
  for (const field of [
    "websiteUrl",
    "linkedinUrl",
    "facebookUrl",
    "githubUrl",
  ] as const) {
    const value = input[field];
    if (value === undefined || value === null) continue;
    if (!isNonEmptyString(value) || !isHttpUrl(value)) {
      issues.push({ field, message: "Enter a valid http(s) URL." });
    }
  }
  if (
    input.profileVisibility !== undefined &&
    !isOneOf(input.profileVisibility, PROFILE_VISIBILITIES)
  ) {
    issues.push({ field: "profileVisibility", message: "Select a visibility." });
  }
  return issues;
}

export function validateUpdatePrivacy(input: {
  showEmail?: unknown;
  showPhone?: unknown;
  showLocation?: unknown;
  showBio?: unknown;
  showCareer?: unknown;
  showEducation?: unknown;
  showSocialLinks?: unknown;
  showProfilePublicly?: unknown;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of [
    "showEmail",
    "showPhone",
    "showLocation",
    "showBio",
    "showCareer",
    "showEducation",
    "showSocialLinks",
    "showProfilePublicly",
  ] as const) {
    checkBoolean(issues, field, input[field]);
  }
  return issues;
}

export function validateStudentProfile(
  input: {
    batchId?: unknown;
    studentId?: unknown;
    enrollmentYear?: unknown;
    expectedGraduationYear?: unknown;
    currentSemester?: unknown;
    department?: unknown;
    academicStatus?: unknown;
  },
  opts: { requireStudentId: boolean },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkBatchId(issues, "batchId", input.batchId);
  // student_id is NOT NULL UNIQUE: required on create, never null.
  if (input.studentId === undefined) {
    if (opts.requireStudentId) {
      issues.push({ field: "studentId", message: "Required." });
    }
  } else {
    checkText(issues, "studentId", input.studentId, PROFILE_LIMITS.studentId, {
      required: true,
    });
  }
  checkYear(issues, "enrollmentYear", input.enrollmentYear);
  checkYear(issues, "expectedGraduationYear", input.expectedGraduationYear);
  checkYearOrder(
    issues,
    "enrollmentYear",
    input.enrollmentYear,
    "expectedGraduationYear",
    input.expectedGraduationYear,
  );
  if (
    input.currentSemester !== undefined &&
    input.currentSemester !== null &&
    (typeof input.currentSemester !== "number" ||
      !Number.isInteger(input.currentSemester) ||
      input.currentSemester < PROFILE_LIMITS.semesterMin ||
      input.currentSemester > PROFILE_LIMITS.semesterMax)
  ) {
    issues.push({
      field: "currentSemester",
      message: `Enter a semester between ${PROFILE_LIMITS.semesterMin} and ${PROFILE_LIMITS.semesterMax}.`,
    });
  }
  checkText(issues, "department", input.department, PROFILE_LIMITS.department, {
    allowNull: true,
  });
  checkText(
    issues,
    "academicStatus",
    input.academicStatus,
    PROFILE_LIMITS.academicStatus,
    { allowNull: true },
  );
  return issues;
}

export function validateAlumniProfile(input: {
  batchId?: unknown;
  graduationYear?: unknown;
  currentCompany?: unknown;
  currentDesignation?: unknown;
  currentLocation?: unknown;
  careerSummary?: unknown;
  availableForMentoring?: unknown;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkBatchId(issues, "batchId", input.batchId);
  checkYear(issues, "graduationYear", input.graduationYear);
  checkText(
    issues,
    "currentCompany",
    input.currentCompany,
    PROFILE_LIMITS.company,
    { allowNull: true },
  );
  checkText(
    issues,
    "currentDesignation",
    input.currentDesignation,
    PROFILE_LIMITS.designation,
    { allowNull: true },
  );
  checkText(
    issues,
    "currentLocation",
    input.currentLocation,
    PROFILE_LIMITS.location,
    { allowNull: true },
  );
  checkText(
    issues,
    "careerSummary",
    input.careerSummary,
    PROFILE_LIMITS.careerSummary,
    { allowNull: true },
  );
  checkBoolean(issues, "availableForMentoring", input.availableForMentoring);
  return issues;
}

export function validateWorkExperience(
  input: {
    company?: unknown;
    designation?: unknown;
    location?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    isCurrent?: unknown;
    description?: unknown;
    displayOrder?: unknown;
  },
  opts: { requireCompany: boolean },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.company === undefined) {
    if (opts.requireCompany) {
      issues.push({ field: "company", message: "Required." });
    }
  } else {
    checkText(issues, "company", input.company, PROFILE_LIMITS.company, {
      required: true,
    });
  }
  checkText(
    issues,
    "designation",
    input.designation,
    PROFILE_LIMITS.designation,
    { allowNull: true },
  );
  checkText(issues, "location", input.location, PROFILE_LIMITS.location, {
    allowNull: true,
  });
  checkDate(issues, "startDate", input.startDate);
  checkDate(issues, "endDate", input.endDate);
  if (
    isDateOnly(input.startDate) &&
    isDateOnly(input.endDate) &&
    input.endDate < input.startDate
  ) {
    issues.push({ field: "endDate", message: "Must not be before the start." });
  }
  checkBoolean(issues, "isCurrent", input.isCurrent);
  if (
    input.isCurrent === true &&
    input.endDate !== undefined &&
    input.endDate !== null
  ) {
    issues.push({
      field: "endDate",
      message: "Current roles must not have an end date.",
    });
  }
  checkText(
    issues,
    "description",
    input.description,
    PROFILE_LIMITS.description,
    { allowNull: true },
  );
  checkDisplayOrder(issues, "displayOrder", input.displayOrder);
  return issues;
}

export function validateEducation(
  input: {
    institution?: unknown;
    degree?: unknown;
    fieldOfStudy?: unknown;
    startYear?: unknown;
    endYear?: unknown;
    description?: unknown;
    displayOrder?: unknown;
  },
  opts: { requireInstitution: boolean },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.institution === undefined) {
    if (opts.requireInstitution) {
      issues.push({ field: "institution", message: "Required." });
    }
  } else {
    checkText(
      issues,
      "institution",
      input.institution,
      PROFILE_LIMITS.institution,
      { required: true },
    );
  }
  checkText(issues, "degree", input.degree, PROFILE_LIMITS.degree, {
    allowNull: true,
  });
  checkText(
    issues,
    "fieldOfStudy",
    input.fieldOfStudy,
    PROFILE_LIMITS.fieldOfStudy,
    { allowNull: true },
  );
  checkYear(issues, "startYear", input.startYear);
  checkYear(issues, "endYear", input.endYear);
  checkYearOrder(issues, "startYear", input.startYear, "endYear", input.endYear);
  checkText(
    issues,
    "description",
    input.description,
    PROFILE_LIMITS.description,
    { allowNull: true },
  );
  checkDisplayOrder(issues, "displayOrder", input.displayOrder);
  return issues;
}

/** Record/batch identifiers from URLs/actions must be UUIDs (else 400). */
export function validateRecordId(
  value: unknown,
  field = "id",
): ValidationIssue[] {
  if (!isUuid(value)) {
    return [{ field, message: "Invalid identifier." }];
  }
  return [];
}
