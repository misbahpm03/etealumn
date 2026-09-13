"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { createDocumentAction, type ArchiveActionResult } from "./actions";
import { routes } from "@/lib/routes";
import type { DocumentCategory } from "@/types";

const INITIAL_STATE: ArchiveActionResult = { ok: false, error: "" };

const INPUT_CLASSES =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 disabled:opacity-60";
const LABEL_CLASSES = "mb-1 block text-sm font-medium text-zinc-900";
const FIELD_ERROR_CLASSES = "mt-1 text-sm text-red-700";

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className={FIELD_ERROR_CLASSES}>
      {message}
    </p>
  );
}

/**
 * New-submission form. Creates a PRIVATE DRAFT with its first file
 * version — review, visibility, and publishing all happen afterwards
 * from the document page. Redirects to the new document on success.
 */
export function DocumentForm({
  categories,
}: {
  categories: ReadonlyArray<DocumentCategory>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    (_previous: ArchiveActionResult, formData: FormData) =>
      createDocumentAction(formData),
    INITIAL_STATE,
  );
  useEffect(() => {
    if (state.ok && state.documentId) {
      router.push(routes.portal.archiveDetail(state.documentId));
    }
  }, [state, router]);
  const fieldErrors =
    !state.ok && state.fieldErrors ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      {!state.ok && state.error !== "" ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="doc-title" className={LABEL_CLASSES}>
          Title
        </label>
        <input
          id="doc-title"
          name="title"
          type="text"
          required
          disabled={pending}
          className={INPUT_CLASSES}
          placeholder="e.g. Low-cost water quality sensing in the Buriganga"
        />
        <FieldError message={fieldErrors?.title} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="doc-category" className={LABEL_CLASSES}>
            Category
          </label>
          <select
            id="doc-category"
            name="categoryId"
            required
            disabled={pending}
            defaultValue=""
            className={INPUT_CLASSES}
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors?.categoryId} />
        </div>
        <div>
          <label htmlFor="doc-year" className={LABEL_CLASSES}>
            Year
          </label>
          <input
            id="doc-year"
            name="year"
            type="number"
            inputMode="numeric"
            disabled={pending}
            className={INPUT_CLASSES}
            placeholder="e.g. 2026"
          />
          <FieldError message={fieldErrors?.year} />
        </div>
      </div>

      <div>
        <label htmlFor="doc-description" className={LABEL_CLASSES}>
          Description
        </label>
        <textarea
          id="doc-description"
          name="description"
          rows={3}
          disabled={pending}
          className={INPUT_CLASSES}
          placeholder="Short summary — required before submission for review."
        />
        <FieldError message={fieldErrors?.description} />
      </div>

      <div>
        <label htmlFor="doc-abstract" className={LABEL_CLASSES}>
          Abstract
        </label>
        <textarea
          id="doc-abstract"
          name="abstract"
          rows={4}
          disabled={pending}
          className={INPUT_CLASSES}
        />
        <FieldError message={fieldErrors?.abstract} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="doc-supervisor" className={LABEL_CLASSES}>
            Supervisor
          </label>
          <input
            id="doc-supervisor"
            name="supervisorName"
            type="text"
            disabled={pending}
            className={INPUT_CLASSES}
          />
          <FieldError message={fieldErrors?.supervisorName} />
        </div>
        <div>
          <label htmlFor="doc-keywords" className={LABEL_CLASSES}>
            Keywords
          </label>
          <input
            id="doc-keywords"
            name="keywords"
            type="text"
            disabled={pending}
            className={INPUT_CLASSES}
            placeholder="Comma-separated"
          />
          <FieldError message={fieldErrors?.keywords} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="doc-visibility" className={LABEL_CLASSES}>
            Visibility
          </label>
          <select
            id="doc-visibility"
            name="visibility"
            disabled={pending}
            defaultValue="PRIVATE"
            className={INPUT_CLASSES}
          >
            <option value="PRIVATE">Private</option>
            <option value="STUDENT_ONLY">Students & alumni</option>
            <option value="FACULTY_ONLY">Faculty & staff</option>
            <option value="PUBLIC">Public</option>
          </select>
          <p className="mt-1 text-sm text-zinc-500">
            Applies once approved; drafts stay owner-visible.
          </p>
          <FieldError message={fieldErrors?.visibility} />
        </div>
        <div className="flex items-start gap-2 pt-7">
          <input
            id="doc-allow-download"
            name="allowDownload"
            type="checkbox"
            disabled={pending}
            className="mt-1 h-4 w-4 rounded border-zinc-300"
          />
          <label htmlFor="doc-allow-download" className="text-sm text-zinc-700">
            Allow downloads
            <span className="block text-zinc-500">
              Readers may download the file once approved.
            </span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="doc-file" className={LABEL_CLASSES}>
          File
        </label>
        <input
          id="doc-file"
          name="file"
          type="file"
          required
          disabled={pending}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.tex,.png,.jpg,.jpeg,.zip"
          className="block w-full text-sm text-zinc-700 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-50 disabled:opacity-60"
        />
        <p className="mt-1 text-sm text-zinc-500">
          PDF, Office documents, text, images, or ZIP — up to 25 MB. Stored
          privately; replacements become new versions.
        </p>
        <FieldError message={fieldErrors?.file} />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {pending ? "Creating draft…" : "Create draft"}
        </button>
      </div>
    </form>
  );
}
