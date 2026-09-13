"use client";

import { useActionState } from "react";
import { useRefreshOnSuccess } from "./use-refresh-on-success";
import {
  archiveDocumentAction,
  approveDocumentAction,
  beginReviewAction,
  rejectDocumentAction,
  reopenDocumentAction,
  restoreDocumentAction,
  revokePermissionAction,
  softDeleteDocumentAction,
  submitDocumentAction,
  updateVisibilityAction,
  type ArchiveActionResult,
} from "./actions";
import type { DocumentVisibility } from "@/types";

const INITIAL_STATE: ArchiveActionResult = { ok: false, error: "" };

type LifecycleAction = (
  formData: FormData,
) => Promise<ArchiveActionResult>;

const ACTIONS: Record<string, LifecycleAction> = {
  submit: submitDocumentAction,
  beginReview: beginReviewAction,
  approve: approveDocumentAction,
  reject: rejectDocumentAction,
  archive: archiveDocumentAction,
  reopen: reopenDocumentAction,
  softDelete: softDeleteDocumentAction,
  restore: restoreDocumentAction,
};

const BUTTON_CLASSES =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none";

const VARIANTS = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700",
  secondary: "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
} as const;

/**
 * One-button lifecycle/moderation action. Button visibility is UX
 * convenience ONLY — the service re-checks ownership, role, and the
 * transition map on every call, so hidden buttons are never a bypass.
 */
export function ArchiveActionButton({
  action,
  documentId,
  label,
  pendingLabel,
  confirmMessage,
  variant = "secondary",
}: {
  action: keyof typeof ACTIONS;
  documentId: string;
  label: string;
  pendingLabel: string;
  confirmMessage?: string;
  variant?: keyof typeof VARIANTS;
}) {
  const run = ACTIONS[action];
  const [state, formAction, pending] = useActionState(
    (_previous: ArchiveActionResult, formData: FormData) => run(formData),
    INITIAL_STATE,
  );
  useRefreshOnSuccess(state);
  return (
    <form
      action={formAction}
      onSubmit={
        confirmMessage
          ? (event) => {
              if (!window.confirm(confirmMessage)) event.preventDefault();
            }
          : undefined
      }
    >
      <input type="hidden" name="id" value={documentId} />
      {!state.ok && state.error !== "" ? (
        <p role="alert" className="mb-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={`${BUTTON_CLASSES} ${VARIANTS[variant]}`}
      >
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: DocumentVisibility;
  label: string;
}> = [
  { value: "PRIVATE", label: "Private — only you, grantees, and staff" },
  { value: "STUDENT_ONLY", label: "Students & alumni (when approved)" },
  { value: "FACULTY_ONLY", label: "Faculty & staff (when approved)" },
  { value: "PUBLIC", label: "Public — anyone (when approved)" },
];

/** Visibility editor (owner while drafting, admin anytime — enforced server-side). */
export function VisibilityForm({
  documentId,
  current,
}: {
  documentId: string;
  current: DocumentVisibility;
}) {
  const [state, formAction, pending] = useActionState(
    (_previous: ArchiveActionResult, formData: FormData) =>
      updateVisibilityAction(formData),
    INITIAL_STATE,
  );
  useRefreshOnSuccess(state);
  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="id" value={documentId} />
      <div>
        <label
          htmlFor={`visibility-${documentId}`}
          className="mb-1 block text-sm font-medium text-zinc-900"
        >
          Visibility
        </label>
        <select
          id={`visibility-${documentId}`}
          name="visibility"
          defaultValue={current}
          disabled={pending}
          className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 disabled:opacity-60"
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className={`${BUTTON_CLASSES} ${VARIANTS.secondary}`}
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {!state.ok && state.error !== "" ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Single-grant revoke button (owner/admin grant lists). */
export function RevokeGrantButton({
  documentId,
  userId,
  permission,
}: {
  documentId: string;
  userId: string;
  permission: "VIEW" | "DOWNLOAD";
}) {
  const [state, formAction, pending] = useActionState(
    (_previous: ArchiveActionResult, formData: FormData) =>
      revokePermissionAction(formData),
    INITIAL_STATE,
  );
  useRefreshOnSuccess(state);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Revoke this ${permission} grant?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={documentId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="permission" value={permission} />
      {!state.ok && state.error !== "" ? (
        <p role="alert" className="mb-1 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer text-sm font-medium text-red-700 underline-offset-2 hover:underline disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
    </form>
  );
}
