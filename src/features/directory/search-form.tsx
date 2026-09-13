import { routes } from "@/lib/routes";
import type { PublicBatch } from "@/types";

/** Current filter values, echoed back into the form (all optional). */
export interface DirectoryFilters {
  text?: string;
  batchId?: string;
  graduationYear?: string;
  company?: string;
  designation?: string;
  location?: string;
  role?: string;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none";

const labelClass = "mb-1 block text-xs font-medium text-zinc-600";

/**
 * Native GET form — no client JavaScript. Submitting navigates to /alumni
 * with query params; the server page validates + searches. Only filters
 * the schema supports are offered (no industry/skills/city — see the
 * architecture doc for what is deliberately absent).
 */
export function DirectorySearchForm({
  batches,
  current,
}: {
  batches: ReadonlyArray<PublicBatch>;
  current: DirectoryFilters;
}) {
  return (
    <form
      method="get"
      action={routes.public.alumni}
      className="rounded-lg border border-zinc-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="directory-q" className={labelClass}>
            Name
          </label>
          <input
            id="directory-q"
            name="q"
            type="search"
            defaultValue={current.text ?? ""}
            placeholder="Search by name"
            maxLength={100}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="directory-batch" className={labelClass}>
            Batch
          </label>
          <select
            id="directory-batch"
            name="batch"
            defaultValue={current.batchId ?? ""}
            className={inputClass}
          >
            <option value="">All batches</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="directory-year" className={labelClass}>
            Graduation year
          </label>
          <input
            id="directory-year"
            name="year"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            defaultValue={current.graduationYear ?? ""}
            placeholder="Any year"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="directory-company" className={labelClass}>
            Company
          </label>
          <input
            id="directory-company"
            name="company"
            type="text"
            defaultValue={current.company ?? ""}
            placeholder="Any company"
            maxLength={100}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="directory-designation" className={labelClass}>
            Designation
          </label>
          <input
            id="directory-designation"
            name="designation"
            type="text"
            defaultValue={current.designation ?? ""}
            placeholder="Any designation"
            maxLength={100}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="directory-location" className={labelClass}>
            Location
          </label>
          <input
            id="directory-location"
            name="location"
            type="text"
            defaultValue={current.location ?? ""}
            placeholder="Any location"
            maxLength={100}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="directory-role" className={labelClass}>
            Directory
          </label>
          <select
            id="directory-role"
            name="role"
            defaultValue={current.role ?? "ALUMNI"}
            className={inputClass}
          >
            <option value="ALUMNI">Alumni</option>
            <option value="STUDENT">Students</option>
            <option value="FACULTY">Faculty</option>
            <option value="">Everyone</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Search
        </button>
        <a
          href={routes.public.alumni}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Clear
        </a>
      </div>
    </form>
  );
}
