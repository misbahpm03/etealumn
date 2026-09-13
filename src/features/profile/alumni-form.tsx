"use client";

import { useActionState } from "react";
import type { AlumniProfile, Batch } from "@/types";
import { saveAlumniProfileAction, type ProfileActionResult } from "./actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const INITIAL_STATE: ProfileActionResult = { ok: false, error: "" };

const inputClassName =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900 " +
  "focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60";
const labelClassName = "mb-1 block text-sm font-medium text-zinc-900";

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-red-700">
      {message}
    </p>
  );
}

export function AlumniForm({
  alumni,
  batches,
}: {
  alumni: AlumniProfile | null;
  batches: ReadonlyArray<Batch>;
}) {
  const [state, formAction, pending] = useActionState(
    (_previous: ProfileActionResult, formData: FormData) =>
      saveAlumniProfileAction(formData),
    INITIAL_STATE,
  );
  useRefreshOnSuccess(state);
  const fieldErrors =
    !state.ok && state.fieldErrors ? state.fieldErrors : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.ok ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Alumni details saved.
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="alumni-batchId" className={labelClassName}>
            Batch
          </label>
          <select
            id="alumni-batchId"
            name="batchId"
            disabled={pending}
            defaultValue={alumni?.batchId ?? ""}
            className={inputClassName}
          >
            <option value="">No batch assigned</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
                {batch.status === "ARCHIVED" ? " (archived)" : ""}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors?.batchId} />
        </div>
        <div>
          <label htmlFor="alumni-graduationYear" className={labelClassName}>
            Graduation year
          </label>
          <input
            id="alumni-graduationYear"
            name="graduationYear"
            type="number"
            min={1900}
            max={2100}
            disabled={pending}
            defaultValue={alumni?.graduationYear ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.graduationYear} />
        </div>
        <div>
          <label htmlFor="alumni-currentCompany" className={labelClassName}>
            Current company
          </label>
          <input
            id="alumni-currentCompany"
            name="currentCompany"
            type="text"
            disabled={pending}
            defaultValue={alumni?.currentCompany ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.currentCompany} />
        </div>
        <div>
          <label htmlFor="alumni-currentDesignation" className={labelClassName}>
            Current designation
          </label>
          <input
            id="alumni-currentDesignation"
            name="currentDesignation"
            type="text"
            disabled={pending}
            defaultValue={alumni?.currentDesignation ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.currentDesignation} />
        </div>
        <div>
          <label htmlFor="alumni-currentLocation" className={labelClassName}>
            Current location
          </label>
          <input
            id="alumni-currentLocation"
            name="currentLocation"
            type="text"
            disabled={pending}
            defaultValue={alumni?.currentLocation ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.currentLocation} />
        </div>
        <div className="flex items-end pb-3">
          <label
            htmlFor="alumni-availableForMentoring"
            className="flex items-center gap-2 text-sm font-medium text-zinc-900"
          >
            <input
              id="alumni-availableForMentoring"
              name="availableForMentoring"
              type="checkbox"
              disabled={pending}
              defaultChecked={alumni?.availableForMentoring ?? false}
              className="h-4 w-4 accent-zinc-900"
            />
            Available for mentoring
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="alumni-careerSummary" className={labelClassName}>
          Career summary
        </label>
        <textarea
          id="alumni-careerSummary"
          name="careerSummary"
          rows={4}
          disabled={pending}
          defaultValue={alumni?.careerSummary ?? ""}
          className={inputClassName}
        />
        <FieldError message={fieldErrors?.careerSummary} />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {pending ? "Saving…" : "Save alumni details"}
        </button>
      </div>
    </form>
  );
}
