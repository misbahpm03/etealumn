"use client";

import { useActionState } from "react";
import type { Batch, StudentProfile } from "@/types";
import { saveStudentProfileAction, type ProfileActionResult } from "./actions";
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

export function StudentForm({
  student,
  batches,
}: {
  student: StudentProfile | null;
  batches: ReadonlyArray<Batch>;
}) {
  const [state, formAction, pending] = useActionState(
    (_previous: ProfileActionResult, formData: FormData) =>
      saveStudentProfileAction(formData),
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
          Student details saved.
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
          <label htmlFor="student-batchId" className={labelClassName}>
            Batch
          </label>
          <select
            id="student-batchId"
            name="batchId"
            disabled={pending}
            defaultValue={student?.batchId ?? ""}
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
          <label htmlFor="student-studentId" className={labelClassName}>
            Student ID
          </label>
          <input
            id="student-studentId"
            name="studentId"
            type="text"
            required={!student}
            disabled={pending}
            defaultValue={student?.studentId ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.studentId} />
        </div>
        <div>
          <label htmlFor="student-enrollmentYear" className={labelClassName}>
            Enrollment year
          </label>
          <input
            id="student-enrollmentYear"
            name="enrollmentYear"
            type="number"
            min={1900}
            max={2100}
            disabled={pending}
            defaultValue={student?.enrollmentYear ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.enrollmentYear} />
        </div>
        <div>
          <label htmlFor="student-expectedGraduationYear" className={labelClassName}>
            Expected graduation year
          </label>
          <input
            id="student-expectedGraduationYear"
            name="expectedGraduationYear"
            type="number"
            min={1900}
            max={2100}
            disabled={pending}
            defaultValue={student?.expectedGraduationYear ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.expectedGraduationYear} />
        </div>
        <div>
          <label htmlFor="student-currentSemester" className={labelClassName}>
            Current semester
          </label>
          <input
            id="student-currentSemester"
            name="currentSemester"
            type="number"
            min={1}
            max={20}
            disabled={pending}
            defaultValue={student?.currentSemester ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.currentSemester} />
        </div>
        <div>
          <label htmlFor="student-department" className={labelClassName}>
            Department
          </label>
          <input
            id="student-department"
            name="department"
            type="text"
            disabled={pending}
            defaultValue={student?.department ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.department} />
        </div>
      </div>

      <div>
        <label htmlFor="student-academicStatus" className={labelClassName}>
          Academic status
        </label>
        <input
          id="student-academicStatus"
          name="academicStatus"
          type="text"
          disabled={pending}
          defaultValue={student?.academicStatus ?? ""}
          className={inputClassName}
        />
        <FieldError message={fieldErrors?.academicStatus} />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {pending ? "Saving…" : "Save student details"}
        </button>
      </div>
    </form>
  );
}
