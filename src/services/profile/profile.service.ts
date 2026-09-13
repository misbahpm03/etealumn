import { STORAGE_BUCKETS } from "@/config/storage";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import type {
  AlumniProfileRepository,
  AuditLogRepository,
  BatchRepository,
  EducationRepository,
  ProfilePrivacyRepository,
  ProfileRepository,
  StudentProfileRepository,
  WorkExperienceRepository,
} from "@/repositories";
import {
  assertActiveUser,
  assertRole,
} from "@/services/auth/guards";
import type {
  MediaAccess,
  MediaFile,
  MediaStorageService,
} from "@/services/storage";
import type {
  AlumniProfile,
  AlumniProfileInput,
  Batch,
  Education,
  EducationInput,
  OnboardingState,
  Profile,
  ProfilePrivacy,
  SessionUser,
  StudentProfile,
  Uuid,
  UpdateEducationInput,
  UpdatePrivacyInput,
  UpdateProfileInput,
  UpdateStudentProfileInput,
  UpdateWorkExperienceInput,
  WorkExperience,
  WorkExperienceInput,
} from "@/types";
import {
  validateAlumniProfile,
  validateEducation,
  validateRecordId,
  validateStudentProfile,
  validateUpdatePrivacy,
  validateUpdateProfile,
  validateWorkExperience,
} from "@/validations/profile";
import { validateUploadForBucket } from "@/validations/uploads";

/**
 * Repository wiring. Client scope is a deliberate per-repo choice:
 * request-client (RLS) everywhere RLS grants self-service; privileged ONLY
 * where RLS intentionally lacks a policy (profile/privacy ensure for
 * PENDING users, student/alumni creation + verified fields, audit writes).
 */
export interface ProfileServiceDeps {
  profiles: ProfileRepository;
  profilesPrivileged: ProfileRepository;
  privacy: ProfilePrivacyRepository;
  privacyPrivileged: ProfilePrivacyRepository;
  students: StudentProfileRepository;
  alumni: AlumniProfileRepository;
  work: WorkExperienceRepository;
  education: EducationRepository;
  batches: BatchRepository;
  audit: AuditLogRepository;
  photos: MediaStorageService;
}

/**
 * Current-user profile service. Binds ONE server-resolved application user
 * at construction — every method operates on that user only. There is no
 * `userId` parameter anywhere: ownership cannot be supplied by the browser.
 *
 * Uniform rules: ACTIVE status required for everything except
 * `ensureInitialized` (idempotent provisioning writes only the caller's own
 * rows, like the signup trigger); role-specific methods additionally
 * require the matching authoritative role from `users` (never input).
 */
export class ProfileService {
  constructor(
    private readonly deps: ProfileServiceDeps,
    private readonly appUser: SessionUser,
  ) {}

  private get userId(): Uuid {
    return this.appUser.id;
  }

  // ------------------------------------------------------------- ensure ---
  /**
   * Idempotent profile/privacy provisioning. Safe for any status (writes
   * only the caller's own rows); race-safe via the UNIQUE(user_id)
   * constraints — a conflicting concurrent insert falls back to re-read.
   */
  async ensureInitialized(): Promise<{
    profile: Profile;
    privacy: ProfilePrivacy;
  }> {
    const profile = await this.ensureProfile();
    const privacy = await this.ensurePrivacy();
    return { profile, privacy };
  }

  private async ensureProfile(): Promise<Profile> {
    const existing = await this.deps.profilesPrivileged.findByUserId(
      this.userId,
    );
    if (existing) return existing;
    try {
      return await this.deps.profilesPrivileged.create({
        userId: this.userId,
        fullName: placeholderName(this.appUser.email),
      });
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      const raced = await this.deps.profilesPrivileged.findByUserId(
        this.userId,
      );
      if (!raced) throw error;
      return raced;
    }
  }

  private async ensurePrivacy(): Promise<ProfilePrivacy> {
    const existing = await this.deps.privacyPrivileged.findByUserId(
      this.userId,
    );
    if (existing) return existing;
    try {
      return await this.deps.privacyPrivileged.create({
        userId: this.userId,
      });
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      const raced = await this.deps.privacyPrivileged.findByUserId(
        this.userId,
      );
      if (!raced) throw error;
      return raced;
    }
  }

  // ------------------------------------------------------------ profile ---
  async getCurrentProfile(): Promise<Profile | null> {
    assertActiveUser(this.appUser);
    return this.deps.profiles.findByUserId(this.userId);
  }

  async updateCurrentProfile(input: UpdateProfileInput): Promise<Profile> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateUpdateProfile(input));
    await this.ensureInitialized();
    // Request client: RLS independently enforces owner + ACTIVE.
    // Ordinary field edits are not audit-logged (noise); privacy/photo/
    // verified-field changes below are.
    return this.deps.profiles.update(this.userId, input);
  }

  // ------------------------------------------------------------ privacy ---
  async getCurrentPrivacy(): Promise<ProfilePrivacy | null> {
    assertActiveUser(this.appUser);
    return this.deps.privacy.findByUserId(this.userId);
  }

  async updateCurrentPrivacy(
    input: UpdatePrivacyInput,
  ): Promise<ProfilePrivacy> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateUpdatePrivacy(input));
    const { privacy: before } = await this.ensureInitialized();
    const updated = await this.deps.privacy.update(this.userId, input);
    await this.deps.audit.record({
      actorId: this.userId,
      action: "profile_privacy_updated",
      entityType: "profile_privacy",
      entityId: updated.id,
      // Flag NAMES only — values are booleans, still kept minimal.
      metadata: { changed: changedKeys(before, updated) },
    });
    return updated;
  }

  // ------------------------------------------------------------ student ---
  async getCurrentStudentProfile(): Promise<StudentProfile | null> {
    assertRole(this.appUser, "STUDENT");
    return this.deps.students.findByUserId(this.userId);
  }

  /**
   * Audited server-side upsert (RLS offers no self-service INSERT here by
   * design). Enforces STUDENT role, validates the MERGED object (partial
   * patches cannot create contradictory states), and pins batch validity.
   */
  async saveCurrentStudentProfile(
    input: UpdateStudentProfileInput,
  ): Promise<StudentProfile> {
    assertRole(this.appUser, "STUDENT");
    const existing = await this.deps.students.findByUserId(this.userId);
    throwIfIssues(
      validateStudentProfile(
        { ...toStudentInput(existing), ...input },
        { requireStudentId: !existing },
      ),
    );
    await this.assertBatchExists(input.batchId);
    const saved = existing
      ? await this.deps.students.update(this.userId, input)
      : await this.deps.students.create({
          userId: this.userId,
          // Validated present above when creating.
          studentId: input.studentId as string,
          ...input,
        });
    await this.deps.audit.record({
      actorId: this.userId,
      action: "student_profile_saved",
      entityType: "student_profiles",
      entityId: saved.id,
      // Field names + batch reference only — student_id is sensitive.
      metadata: {
        created: !existing,
        fields: Object.keys(toStudentInput(input)),
        batchId: input.batchId ?? null,
      },
    });
    return saved;
  }

  // ------------------------------------------------------------- alumni ---
  async getCurrentAlumniProfile(): Promise<AlumniProfile | null> {
    assertRole(this.appUser, "ALUMNI");
    return this.deps.alumni.findByUserId(this.userId);
  }

  /** Audited server-side upsert — same posture as student profiles. */
  async saveCurrentAlumniProfile(
    input: AlumniProfileInput,
  ): Promise<AlumniProfile> {
    assertRole(this.appUser, "ALUMNI");
    const existing = await this.deps.alumni.findByUserId(this.userId);
    throwIfIssues(
      validateAlumniProfile({ ...toAlumniInput(existing), ...input }),
    );
    await this.assertBatchExists(input.batchId);
    const saved = existing
      ? await this.deps.alumni.update(this.userId, input)
      : await this.deps.alumni.create({ userId: this.userId, ...input });
    await this.deps.audit.record({
      actorId: this.userId,
      action: "alumni_profile_saved",
      entityType: "alumni_profiles",
      entityId: saved.id,
      metadata: {
        created: !existing,
        fields: Object.keys(toAlumniInput(input)),
        batchId: input.batchId ?? null,
      },
    });
    return saved;
  }

  // -------------------------------------------------------------- batch ---
  /** The caller's linked batch (role-appropriate row), or null. */
  async getCurrentBatch(): Promise<Batch | null> {
    assertActiveUser(this.appUser);
    let batchId: Uuid | null = null;
    if (this.appUser.role === "STUDENT") {
      batchId = (await this.deps.students.findByUserId(this.userId))?.batchId
        ?? null;
    } else if (this.appUser.role === "ALUMNI") {
      batchId = (await this.deps.alumni.findByUserId(this.userId))?.batchId
        ?? null;
    } else {
      return null;
    }
    if (!batchId) return null;
    return this.deps.batches.findById(batchId);
  }

  /** All batches for pickers (public reference data; portal callers only). */
  async listBatches(): Promise<ReadonlyArray<Batch>> {
    assertActiveUser(this.appUser);
    return this.deps.batches.listAll();
  }

  private async assertBatchExists(batchId: Uuid | null | undefined): Promise<void> {
    if (batchId === undefined || batchId === null) return;
    const batch = await this.deps.batches.findById(batchId);
    if (!batch) {
      throw new ValidationError([
        { field: "batchId", message: "Selected batch no longer exists." },
      ]);
    }
    // Both ACTIVE and ARCHIVED batches are linkable: ARCHIVED means aged
    // out (browsable history), not invalid — alumni history depends on it.
  }

  // --------------------------------------------------------------- work ---
  async listWorkExperience(): Promise<ReadonlyArray<WorkExperience>> {
    assertActiveUser(this.appUser);
    return this.deps.work.listByUserId(this.userId);
  }

  async addWorkExperience(
    input: WorkExperienceInput,
  ): Promise<WorkExperience> {
    assertActiveUser(this.appUser);
    throwIfIssues(
      validateWorkExperience(input, { requireCompany: true }),
    );
    return this.deps.work.create(this.userId, input);
  }

  async updateWorkExperience(
    id: Uuid,
    patch: UpdateWorkExperienceInput,
  ): Promise<WorkExperience> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    // Owned-or-NotFound: the repo pins user_id, so foreign ids read as
    // missing (no existence oracle for other users' entries).
    const existing = await this.deps.work.findById(id, this.userId);
    if (!existing) throw new NotFoundError("Work experience");
    throwIfIssues(
      validateWorkExperience({ ...existing, ...patch }, { requireCompany: true }),
    );
    return this.deps.work.update(id, this.userId, patch);
  }

  async removeWorkExperience(id: Uuid): Promise<void> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    await this.deps.work.remove(id, this.userId);
  }

  // ---------------------------------------------------------- education ---
  async listEducation(): Promise<ReadonlyArray<Education>> {
    assertActiveUser(this.appUser);
    return this.deps.education.listByUserId(this.userId);
  }

  async addEducation(input: EducationInput): Promise<Education> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateEducation(input, { requireInstitution: true }));
    return this.deps.education.create(this.userId, input);
  }

  async updateEducation(
    id: Uuid,
    patch: UpdateEducationInput,
  ): Promise<Education> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    const existing = await this.deps.education.findById(id, this.userId);
    if (!existing) throw new NotFoundError("Education");
    throwIfIssues(
      validateEducation({ ...existing, ...patch }, { requireInstitution: true }),
    );
    return this.deps.education.update(id, this.userId, patch);
  }

  async removeEducation(id: Uuid): Promise<void> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(id));
    await this.deps.education.remove(id, this.userId);
  }

  // -------------------------------------------------------------- photo ---
  /**
   * Photo replace: upload new object → swap pointer → audit → drop the old
   * object. If the pointer update fails, the NEW object is removed (never
   * orphaned); old-object cleanup is best-effort AFTER the swap succeeds,
   * so a cleanup failure can never break the live reference.
   */
  async uploadProfilePhoto(file: MediaFile): Promise<Profile> {
    assertActiveUser(this.appUser);
    throwIfIssues(
      validateUploadForBucket(file, STORAGE_BUCKETS.PROFILE_MEDIA),
    );
    const { profile: before } = await this.ensureInitialized();
    // Owner and requester are BOTH the server-resolved user: writing into
    // another user's path is structurally impossible.
    const uploaded = await this.deps.photos.uploadProfileMedia({
      ownerId: this.userId,
      requesterId: this.userId,
      file,
    });
    let updated: Profile;
    try {
      updated = await this.deps.profiles.update(this.userId, {
        profilePhotoPath: uploaded.path,
      });
    } catch (error) {
      await this.removePhotoObjectBestEffort(uploaded.path);
      throw error;
    }
    await this.deps.audit.record({
      actorId: this.userId,
      action: "profile_photo_updated",
      entityType: "profiles",
      entityId: updated.id,
      metadata: {
        path: uploaded.path,
        previousPath: before.profilePhotoPath,
      },
    });
    if (
      before.profilePhotoPath &&
      before.profilePhotoPath !== uploaded.path
    ) {
      await this.removePhotoObjectBestEffort(before.profilePhotoPath);
    }
    return updated;
  }

  /** Short-lived signed access to the CALLER's own photo (never stored). */
  async getProfilePhotoAccess(): Promise<MediaAccess | null> {
    assertActiveUser(this.appUser);
    const profile = await this.deps.profiles.findByUserId(this.userId);
    if (!profile?.profilePhotoPath) return null;
    return this.deps.photos.getProfileMediaAccess({
      bucket: STORAGE_BUCKETS.PROFILE_MEDIA,
      path: profile.profilePhotoPath,
      ownerId: this.userId,
      requesterId: this.userId,
      isVisibleToRequester: true,
    });
  }

  async removeProfilePhoto(): Promise<Profile> {
    assertActiveUser(this.appUser);
    const { profile: before } = await this.ensureInitialized();
    if (!before.profilePhotoPath) return before;
    const updated = await this.deps.profiles.update(this.userId, {
      profilePhotoPath: null,
    });
    await this.deps.audit.record({
      actorId: this.userId,
      action: "profile_photo_removed",
      entityType: "profiles",
      entityId: updated.id,
      metadata: { previousPath: before.profilePhotoPath },
    });
    await this.removePhotoObjectBestEffort(before.profilePhotoPath);
    return updated;
  }

  private async removePhotoObjectBestEffort(path: string): Promise<void> {
    try {
      await this.deps.photos.removeMedia({
        bucket: STORAGE_BUCKETS.PROFILE_MEDIA,
        path,
        ownerId: this.userId,
        requesterId: this.userId,
      });
    } catch (error) {
      // Cleanup must never break the user-facing operation; orphan
      // reconciliation covers leftovers (see docs/storage.md).
      console.warn("[profile] photo object cleanup failed", error);
    }
  }

  // ---------------------------------------------------------- onboarding ---
  /**
   * Derived onboarding state — computed from live records on every read.
   * No stored completion flag exists (nothing to desync, nothing to forge).
   */
  async getOnboardingState(): Promise<OnboardingState> {
    assertActiveUser(this.appUser);
    const { profile, privacy } = await this.ensureInitialized();
    const roleProfileRequired =
      this.appUser.role === "STUDENT" || this.appUser.role === "ALUMNI";
    let hasRoleProfile = false;
    if (this.appUser.role === "STUDENT") {
      hasRoleProfile =
        (await this.deps.students.findByUserId(this.userId)) !== null;
    } else if (this.appUser.role === "ALUMNI") {
      hasRoleProfile =
        (await this.deps.alumni.findByUserId(this.userId)) !== null;
    }
    const workCount = (await this.deps.work.listByUserId(this.userId)).length;
    const educationCount = (
      await this.deps.education.listByUserId(this.userId)
    ).length;
    // Heuristic: the trigger seeds the email local-part (or "New member");
    // anything else means the member personalized their name.
    const hasCustomName =
      profile.fullName !== placeholderName(this.appUser.email);
    const complete =
      hasCustomName &&
      profile.profilePhotoPath !== null &&
      hasRoleProfileOrNotRequired(roleProfileRequired, hasRoleProfile);
    return {
      role: this.appUser.role,
      status: this.appUser.status,
      hasProfile: true,
      hasCustomName,
      hasPhoto: profile.profilePhotoPath !== null,
      hasPrivacy: privacy !== null,
      roleProfileRequired,
      hasRoleProfile,
      workCount,
      educationCount,
      complete,
    };
  }
}

/** Mirrors the provisioning trigger's placeholder (email local-part). */
function placeholderName(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  return local === "" ? "New member" : local;
}

function hasRoleProfileOrNotRequired(
  required: boolean,
  has: boolean,
): boolean {
  return !required || has;
}

function throwIfIssues(
  issues: ReadonlyArray<{ field: string; message: string }>,
): void {
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}

function changedKeys(
  before: ProfilePrivacy,
  after: ProfilePrivacy,
): string[] {
  const keys = [
    "showEmail",
    "showPhone",
    "showLocation",
    "showBio",
    "showCareer",
    "showEducation",
    "showSocialLinks",
    "showProfilePublicly",
  ] as const;
  return keys.filter((key) => before[key] !== after[key]);
}

/** Narrow entity rows back to validator input (drops ids/timestamps). */
function toStudentInput(
  row: StudentProfile | UpdateStudentProfileInput | null | undefined,
): UpdateStudentProfileInput {
  if (!row) return {};
  return {
    batchId: row.batchId ?? undefined,
    studentId: row.studentId,
    enrollmentYear: row.enrollmentYear ?? undefined,
    expectedGraduationYear: row.expectedGraduationYear ?? undefined,
    currentSemester: row.currentSemester ?? undefined,
    department: row.department ?? undefined,
    academicStatus: row.academicStatus ?? undefined,
  };
}

function toAlumniInput(
  row: AlumniProfile | AlumniProfileInput | null | undefined,
): AlumniProfileInput {
  if (!row) return {};
  return {
    batchId: row.batchId ?? undefined,
    graduationYear: row.graduationYear ?? undefined,
    currentCompany: row.currentCompany ?? undefined,
    currentDesignation: row.currentDesignation ?? undefined,
    currentLocation: row.currentLocation ?? undefined,
    careerSummary: row.careerSummary ?? undefined,
    availableForMentoring: row.availableForMentoring,
  };
}
