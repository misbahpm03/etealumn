"use client";

import { useActionState } from "react";
import type { ProfileActionResult } from "./actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const INITIAL_STATE: ProfileActionResult = { ok: false, error: "" };

/**
 * Own-entry delete button (work/education). The record id travels as a
 * hidden field, but ownership is enforced server-side (repo pins the
 * server-resolved user id; foreign ids read as missing). The confirm
 * dialog is UX only.
 */
export function RemoveEntryButton({
  id,
  label,
  action,
}: {
  id: string;
  label: string;
  action: (formData: FormData) => Promise<ProfileActionResult>;
}) {
  const [state, formAction, pending] = useActionState(
    (_previous: ProfileActionResult, formData: FormData) => action(formData),
    INITIAL_STATE,
  );
  useRefreshOnSuccess(state);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Remove this ${label}?`)) {
          event.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Remove this ${label}`}
        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {!state.ok && state.error !== "" ? (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
