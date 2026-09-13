"use client";

import { useActionState } from "react";
import { grantPermissionAction, type ArchiveActionResult } from "./actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const INITIAL_STATE: ArchiveActionResult = { ok: false, error: "" };

const INPUT_CLASSES =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 disabled:opacity-60";
const LABEL_CLASSES = "mb-1 block text-sm font-medium text-zinc-900";

/**
 * Owner/admin grant form (PRIVATE documents especially). VIEW and DOWNLOAD
 * stay independent — granting VIEW never enables downloads, and a
 * DOWNLOAD grant still requires the document's Downloads switch. Only
 * owners and admins reach this form; the service re-checks regardless.
 */
export function GrantForm({ documentId }: { documentId: string }) {
  const [state, formAction, pending] = useActionState(
    (_previous: ArchiveActionResult, formData: FormData) =>
      grantPermissionAction(formData),
    INITIAL_STATE,
  );
  useRefreshOnSuccess(state);
  const fieldErrors =
    !state.ok && state.fieldErrors ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={documentId} />
      {state.ok ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Access granted.
        </p>
      ) : null}
      {!state.ok && state.error !== "" ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor={`grant-user-${documentId}`} className={LABEL_CLASSES}>
          Member user ID
        </label>
        <input
          id={`grant-user-${documentId}`}
          name="userId"
          type="text"
          required
          disabled={pending}
          className={INPUT_CLASSES}
          placeholder="UUID of an existing member"
        />
        <p className="mt-1 text-sm text-zinc-500">
          The recipient must already be a member. Nobody can grant
          themselves access to another member&apos;s document.
        </p>
        {fieldErrors?.userId ? (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {fieldErrors.userId}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`grant-permission-${documentId}`}
            className={LABEL_CLASSES}
          >
            Permission
          </label>
          <select
            id={`grant-permission-${documentId}`}
            name="permission"
            disabled={pending}
            defaultValue="VIEW"
            className={INPUT_CLASSES}
          >
            <option value="VIEW">VIEW — read metadata, no download</option>
            <option value="DOWNLOAD">DOWNLOAD — read + download</option>
          </select>
          {fieldErrors?.permission ? (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {fieldErrors.permission}
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor={`grant-expiry-${documentId}`}
            className={LABEL_CLASSES}
          >
            Expires on (optional)
          </label>
          <input
            id={`grant-expiry-${documentId}`}
            name="expiresAt"
            type="date"
            disabled={pending}
            className={INPUT_CLASSES}
          />
          <p className="mt-1 text-sm text-zinc-500">
            Blank means no expiry. Expired grants authorize nothing.
          </p>
          {fieldErrors?.expiresAt ? (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {fieldErrors.expiresAt}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {pending ? "Granting…" : "Grant access"}
        </button>
      </div>
    </form>
  );
}
