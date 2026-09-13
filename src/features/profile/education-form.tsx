"use client";

import { useActionState } from "react";
import type { Education } from "@/types";
import {
  addEducationAction,
  updateEducationAction,
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

export function EducationForm({ entry }: { entry?: Education }) {
  const editing = entry !== undefined;
  const [state, formAction, pending] = useActionState(
    (_previous: ProfileActionResult, formData: FormData) =>
      editing
        ? updateEducationAction(formData)
        : addEducationAction(formData),
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
          {editing ? "Education entry updated." : "Education entry added."}
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
          <label htmlFor={editing ? "edu-institution-edit" : "edu-institution"} className={labelClassName}>
            Institution
          </label>
          <input
            id={editing ? "edu-institution-edit" : "edu-institution"}
            name="institution"
            type="text"
            required
            disabled={pending}
            defaultValue={entry?.institution ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.institution} />
        </div>
        <div>
          <label htmlFor={editing ? "edu-degree-edit" : "edu-degree"} className={labelClassName}>
            Degree
          </label>
          <input
            id={editing ? "edu-degree-edit" : "edu-degree"}
            name="degree"
            type="text"
            disabled={pending}
            defaultValue={entry?.degree ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.degree} />
        </div>
        <div>
          <label htmlFor={editing ? "edu-field-edit" : "edu-field"} className={labelClassName}>
            Field of study
          </label>
          <input
            id={editing ? "edu-field-edit" : "edu-field"}
            name="fieldOfStudy"
            type="text"
            disabled={pending}
            defaultValue={entry?.fieldOfStudy ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.fieldOfStudy} />
        </div>
        <div>
          <label htmlFor={editing ? "edu-order-edit" : "edu-order"} className={labelClassName}>
            Display order
          </label>
          <input
            id={editing ? "edu-order-edit" : "edu-order"}
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
          <label htmlFor={editing ? "edu-startYear-edit" : "edu-startYear"} className={labelClassName}>
            Start year
          </label>
          <input
            id={editing ? "edu-startYear-edit" : "edu-startYear"}
            name="startYear"
            type="number"
            min={1900}
            max={2100}
            disabled={pending}
            defaultValue={entry?.startYear ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.startYear} />
        </div>
        <div>
          <label htmlFor={editing ? "edu-endYear-edit" : "edu-endYear"} className={labelClassName}>
            End year
          </label>
          <input
            id={editing ? "edu-endYear-edit" : "edu-endYear"}
            name="endYear"
            type="number"
            min={1900}
            max={2100}
            disabled={pending}
            defaultValue={entry?.endYear ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.endYear} />
        </div>
      </div>

      <div>
        <label htmlFor={editing ? "edu-description-edit" : "edu-description"} className={labelClassName}>
          Description
        </label>
        <textarea
          id={editing ? "edu-description-edit" : "edu-description"}
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
