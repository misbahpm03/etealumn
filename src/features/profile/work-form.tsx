"use client";

import { useActionState } from "react";
import type { WorkExperience } from "@/types";
import {
  addWorkExperienceAction,
  updateWorkExperienceAction,
  type ProfileActionResult,
} from "./actions";
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

export function WorkForm({ entry }: { entry?: WorkExperience }) {
  const editing = entry !== undefined;
  const [state, formAction, pending] = useActionState(
    (_previous: ProfileActionResult, formData: FormData) =>
      editing
        ? updateWorkExperienceAction(formData)
        : addWorkExperienceAction(formData),
    INITIAL_STATE,
  );
  useRefreshOnSuccess(state);
  const fieldErrors =
    !state.ok && state.fieldErrors ? state.fieldErrors : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {editing ? <input type="hidden" name="id" value={entry.id} /> : null}
      {state.ok ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {editing ? "Work entry updated." : "Work entry added."}
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
          <label htmlFor={editing ? "work-company-edit" : "work-company"} className={labelClassName}>
            Company
          </label>
          <input
            id={editing ? "work-company-edit" : "work-company"}
            name="company"
            type="text"
            required
            disabled={pending}
            defaultValue={entry?.company ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.company} />
        </div>
        <div>
          <label htmlFor={editing ? "work-designation-edit" : "work-designation"} className={labelClassName}>
            Designation
          </label>
          <input
            id={editing ? "work-designation-edit" : "work-designation"}
            name="designation"
            type="text"
            disabled={pending}
            defaultValue={entry?.designation ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.designation} />
        </div>
        <div>
          <label htmlFor={editing ? "work-location-edit" : "work-location"} className={labelClassName}>
            Location
          </label>
          <input
            id={editing ? "work-location-edit" : "work-location"}
            name="location"
            type="text"
            disabled={pending}
            defaultValue={entry?.location ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.location} />
        </div>
        <div>
          <label htmlFor={editing ? "work-order-edit" : "work-order"} className={labelClassName}>
            Display order
          </label>
          <input
            id={editing ? "work-order-edit" : "work-order"}
            name="displayOrder"
            type="number"
            min={0}
            disabled={pending}
            defaultValue={entry?.displayOrder ?? 0}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.displayOrder} />
        </div>
        <div>
          <label htmlFor={editing ? "work-start-edit" : "work-start"} className={labelClassName}>
            Start date
          </label>
          <input
            id={editing ? "work-start-edit" : "work-start"}
            name="startDate"
            type="date"
            disabled={pending}
            defaultValue={entry?.startDate ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.startDate} />
        </div>
        <div>
          <label htmlFor={editing ? "work-end-edit" : "work-end"} className={labelClassName}>
            End date
          </label>
          <input
            id={editing ? "work-end-edit" : "work-end"}
            name="endDate"
            type="date"
            disabled={pending}
            defaultValue={entry?.endDate ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.endDate} />
        </div>
      </div>

      <div>
        <label
          htmlFor={editing ? "work-current-edit" : "work-current"}
          className="flex items-center gap-2 text-sm font-medium text-zinc-900"
        >
          <input
            id={editing ? "work-current-edit" : "work-current"}
            name="isCurrent"
            type="checkbox"
            disabled={pending}
            defaultChecked={entry?.isCurrent ?? false}
            className="h-4 w-4 accent-zinc-900"
          />
          I currently work here (no end date)
        </label>
      </div>

      <div>
        <label htmlFor={editing ? "work-description-edit" : "work-description"} className={labelClassName}>
          Description
        </label>
        <textarea
          id={editing ? "work-description-edit" : "work-description"}
          name="description"
          rows={3}
          disabled={pending}
          defaultValue={entry?.description ?? ""}
          className={inputClassName}
        />
        <FieldError message={fieldErrors?.description} />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {pending ? "Saving…" : editing ? "Update entry" : "Add entry"}
        </button>
      </div>
    </form>
  );
}
