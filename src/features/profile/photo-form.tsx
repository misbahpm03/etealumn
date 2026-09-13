"use client";

import { useActionState } from "react";
import {
  removePhotoAction,
  uploadPhotoAction,
  type ProfileActionResult,
} from "./actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const INITIAL_STATE: ProfileActionResult = { ok: false, error: "" };

export function PhotoForm() {
  const [state, formAction, pending] = useActionState(
    (_previous: ProfileActionResult, formData: FormData) =>
      uploadPhotoAction(formData),
    INITIAL_STATE,
  );
  useRefreshOnSuccess(state);
  const fieldError =
    !state.ok && state.fieldErrors ? state.fieldErrors.photo : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.ok ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Photo uploaded.
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
          htmlFor="photo-file"
          className="mb-1 block text-sm font-medium text-zinc-900"
        >
          Profile photo
        </label>
        <input
          id="photo-file"
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          required
          disabled={pending}
          className="block w-full text-sm text-zinc-700 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-50 disabled:opacity-60"
        />
        <p className="mt-1 text-sm text-zinc-500">
          PNG, JPEG, WebP, or GIF. Stored privately; shown via short-lived links.
        </p>
        {fieldError ? (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {fieldError}
          </p>
        ) : null}
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {pending ? "Uploading…" : "Upload photo"}
        </button>
      </div>
    </form>
  );
}

export function PhotoRemoveButton() {
  const [state, formAction, pending] = useActionState(
    // Adapter: the form supplies state/payload; removal needs neither.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_previous: ProfileActionResult, _formData: FormData) =>
      removePhotoAction(),
    INITIAL_STATE,
  );
  useRefreshOnSuccess(state);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Remove your profile photo?")) {
          event.preventDefault();
        }
      }}
    >
      {!state.ok && state.error !== "" ? (
        <p role="alert" className="mb-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {pending ? "Removing…" : "Remove photo"}
      </button>
    </form>
  );
}
