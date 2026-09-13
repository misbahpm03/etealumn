"use client";

import { useActionState } from "react";
import { uploadVersionAction, type ArchiveActionResult } from "./actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const INITIAL_STATE: ArchiveActionResult = { ok: false, error: "" };

/**
 * Owner file replacement while DRAFT/REJECTED. Uploads always append a
 * new immutable version — the previous file stays in history.
 */
export function VersionForm({ documentId }: { documentId: string }) {
  const [state, formAction, pending] = useActionState(
    (_previous: ArchiveActionResult, formData: FormData) =>
      uploadVersionAction(formData),
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
          New version uploaded.
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
        <label
          htmlFor={`version-file-${documentId}`}
          className="mb-1 block text-sm font-medium text-zinc-900"
        >
          Replacement file
        </label>
        <input
          id={`version-file-${documentId}`}
          name="file"
          type="file"
          required
          disabled={pending}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.tex,.png,.jpg,.jpeg,.zip"
          className="block w-full text-sm text-zinc-700 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-50 disabled:opacity-60"
        />
        {fieldErrors?.file ? (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {fieldErrors.file}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor={`version-note-${documentId}`}
          className="mb-1 block text-sm font-medium text-zinc-900"
        >
          Change note
        </label>
        <input
          id={`version-note-${documentId}`}
          name="changeNote"
          type="text"
          disabled={pending}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 disabled:opacity-60"
          placeholder="What changed in this version?"
        />
        {fieldErrors?.changeNote ? (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {fieldErrors.changeNote}
          </p>
        ) : null}
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {pending ? "Uploading…" : "Upload new version"}
        </button>
      </div>
    </form>
  );
}
