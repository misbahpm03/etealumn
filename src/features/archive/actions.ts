"use server";

import { revalidatePath } from "next/cache";
import {
  createAcademicDocumentService,
  createDocumentPermissionService,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import { ValidationError, isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import type { DocumentVisibility, SessionUser } from "@/types";
import { validateRecordId } from "@/validations/profile";

/**
 * Archive server actions — thin composition over the archive services.
 * Every action resolves the caller via `requireActiveUser()` (server
 * session, never client input) and parses FormData into typed values;
 * the SERVICES own validation, ownership, role gating, lifecycle, and
 * auditing. Results carry user-safe messages only.
 */

export interface ArchiveActionSuccess {
  ok: true;
  /** Present when the caller should navigate to the changed document. */
  documentId?: string;
}

export interface ArchiveActionFailure {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
}

export type ArchiveActionResult =
  | ArchiveActionSuccess
  | ArchiveActionFailure;

function toFailure(error: unknown, fallback: string): ArchiveActionFailure {
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
  console.error("[archive] unexpected error", error);
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

/** Comma-separated keywords → trimmed list (null when blank). */
function keywordList(value: FormDataEntryValue | null): string[] | null {
  const raw = text(value);
  if (!raw) return null;
  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  return items.length > 0 ? items : null;
}

async function uploadedFile(
  value: FormDataEntryValue | null,
  field: string,
): Promise<
  | { file: { filename: string; mimeType: string; sizeBytes: number; data: Uint8Array } }
  | { issue: { field: string; message: string } }
> {
  if (!(value instanceof File) || value.size === 0) {
    return { issue: { field, message: "Choose a file to upload." } };
  }
  return {
    file: {
      filename: value.name,
      mimeType: value.type,
      sizeBytes: value.size,
      data: new Uint8Array(await value.arrayBuffer()),
    },
  };
}

function revalidateArchivePages(): void {
  revalidatePath(routes.portal.archive);
  revalidatePath(routes.public.archive);
  revalidatePath(routes.admin.archive);
}

async function archiveServiceFor(user: SessionUser) {
  return createAcademicDocumentService(user);
}

async function permissionServiceFor(user: SessionUser) {
  return createDocumentPermissionService(user);
}

/** actions with only an id field share this parse (invalid → generic error). */
function documentId(formData: FormData): string | null {
  const id = text(formData.get("id"));
  return id && validateRecordId(id).length === 0 ? id : null;
}

// -------------------------------------------------------------- create ---
export async function createDocumentAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  try {
    const year = intField(formData.get("year"));
    if (!year.valid) {
      return toFailure(
        new ValidationError([{ field: "year", message: "Enter a whole number." }]),
        "Invalid input.",
      );
    }
    const upload = await uploadedFile(formData.get("file"), "file");
    if ("issue" in upload) {
      return toFailure(new ValidationError([upload.issue]), "Invalid input.");
    }
    const service = await archiveServiceFor(await requireActiveUser());
    const doc = await service.createDocument(
      {
        title: text(formData.get("title")) ?? "",
        slug: text(formData.get("slug")),
        description: text(formData.get("description")),
        abstract: text(formData.get("abstract")),
        year: year.value,
        supervisorName: text(formData.get("supervisorName")),
        keywords: keywordList(formData.get("keywords")),
        visibility: (text(formData.get("visibility")) ?? undefined) as
          | DocumentVisibility
          | undefined,
        allowDownload: checkbox(formData.get("allowDownload")),
        categoryId: text(formData.get("categoryId")) ?? "",
        batchId: text(formData.get("batchId")),
      },
      upload.file,
    );
    revalidateArchivePages();
    return { ok: true, documentId: doc.id };
  } catch (error) {
    return toFailure(error, "Could not create the document. Please try again.");
  }
}

// -------------------------------------------------------------- update ---
export async function updateDocumentAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  try {
    const id = documentId(formData);
    if (!id) return { ok: false, error: "Invalid request." };
    const year = intField(formData.get("year"));
    if (!year.valid) {
      return toFailure(
        new ValidationError([{ field: "year", message: "Enter a whole number." }]),
        "Invalid input.",
      );
    }
    const service = await archiveServiceFor(await requireActiveUser());
    await service.updateDocument(id, {
      title: text(formData.get("title")) ?? undefined,
      slug: text(formData.get("slug")),
      description: text(formData.get("description")),
      abstract: text(formData.get("abstract")),
      year: year.value,
      supervisorName: text(formData.get("supervisorName")),
      keywords: keywordList(formData.get("keywords")),
      categoryId: text(formData.get("categoryId")) ?? undefined,
      batchId: text(formData.get("batchId")),
      allowDownload: checkbox(formData.get("allowDownload")),
    });
    revalidateArchivePages();
    return { ok: true, documentId: id };
  } catch (error) {
    return toFailure(error, "Could not save the document. Please try again.");
  }
}

export async function updateVisibilityAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  try {
    const id = documentId(formData);
    const visibility = text(formData.get("visibility"));
    if (!id || !visibility) return { ok: false, error: "Invalid request." };
    const service = await archiveServiceFor(await requireActiveUser());
    await service.updateVisibility(id, visibility as DocumentVisibility);
    revalidateArchivePages();
    return { ok: true, documentId: id };
  } catch (error) {
    return toFailure(
      error,
      "Could not change visibility. Please try again.",
    );
  }
}

// ------------------------------------------------------------ lifecycle ---
async function lifecycleAction(
  formData: FormData,
  method:
    | "submitDocument"
    | "beginReview"
    | "approveDocument"
    | "rejectDocument"
    | "archiveDocument"
    | "reopenDocument"
    | "softDeleteDocument"
    | "restoreDocument",
  fallback: string,
): Promise<ArchiveActionResult> {
  try {
    const id = documentId(formData);
    if (!id) return { ok: false, error: "Invalid request." };
    const service = await archiveServiceFor(await requireActiveUser());
    await service[method](id);
    revalidateArchivePages();
    return { ok: true, documentId: id };
  } catch (error) {
    return toFailure(error, fallback);
  }
}

export async function submitDocumentAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  return lifecycleAction(
    formData,
    "submitDocument",
    "Could not submit the document. Please try again.",
  );
}

export async function beginReviewAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  return lifecycleAction(
    formData,
    "beginReview",
    "Could not start the review. Please try again.",
  );
}

export async function approveDocumentAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  return lifecycleAction(
    formData,
    "approveDocument",
    "Could not approve the document. Please try again.",
  );
}

export async function rejectDocumentAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  return lifecycleAction(
    formData,
    "rejectDocument",
    "Could not reject the document. Please try again.",
  );
}

export async function archiveDocumentAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  return lifecycleAction(
    formData,
    "archiveDocument",
    "Could not archive the document. Please try again.",
  );
}

export async function reopenDocumentAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  return lifecycleAction(
    formData,
    "reopenDocument",
    "Could not reopen the document. Please try again.",
  );
}

export async function softDeleteDocumentAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  return lifecycleAction(
    formData,
    "softDeleteDocument",
    "Could not delete the document. Please try again.",
  );
}

export async function restoreDocumentAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  return lifecycleAction(
    formData,
    "restoreDocument",
    "Could not restore the document. Please try again.",
  );
}

// ------------------------------------------------------------ versions ---
export async function uploadVersionAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  try {
    const id = documentId(formData);
    if (!id) return { ok: false, error: "Invalid request." };
    const upload = await uploadedFile(formData.get("file"), "file");
    if ("issue" in upload) {
      return toFailure(new ValidationError([upload.issue]), "Invalid input.");
    }
    const service = await archiveServiceFor(await requireActiveUser());
    await service.uploadVersion(
      id,
      upload.file,
      text(formData.get("changeNote")),
    );
    revalidateArchivePages();
    return { ok: true, documentId: id };
  } catch (error) {
    return toFailure(
      error,
      "Could not upload the new version. Please try again.",
    );
  }
}

// ---------------------------------------------------------- permissions ---
export async function grantPermissionAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  try {
    const id = documentId(formData);
    const userId = text(formData.get("userId"));
    const permission = text(formData.get("permission"));
    if (
      !id ||
      !userId ||
      validateRecordId(userId).length > 0 ||
      (permission !== "VIEW" && permission !== "DOWNLOAD")
    ) {
      return { ok: false, error: "Invalid request." };
    }
    const service = await permissionServiceFor(await requireActiveUser());
    await service.grantPermission(id, {
      userId,
      permission,
      expiresAt: text(formData.get("expiresAt")),
    });
    revalidateArchivePages();
    return { ok: true, documentId: id };
  } catch (error) {
    return toFailure(error, "Could not grant access. Please try again.");
  }
}

export async function revokePermissionAction(
  formData: FormData,
): Promise<ArchiveActionResult> {
  try {
    const id = documentId(formData);
    const userId = text(formData.get("userId"));
    const permission = text(formData.get("permission"));
    if (
      !id ||
      !userId ||
      validateRecordId(userId).length > 0 ||
      (permission !== "VIEW" && permission !== "DOWNLOAD")
    ) {
      return { ok: false, error: "Invalid request." };
    }
    const service = await permissionServiceFor(await requireActiveUser());
    await service.revokePermission(id, userId, permission);
    revalidateArchivePages();
    return { ok: true, documentId: id };
  } catch (error) {
    return toFailure(error, "Could not revoke access. Please try again.");
  }
}
