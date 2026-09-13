"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { updateDocumentAction, type ArchiveActionResult } from "./actions";
import { routes } from "@/lib/routes";
import type { Batch, Document, DocumentCategory } from "@/types";

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
 * Owner metadata edit (DRAFT/REJECTED only). The page hides this form for
 * locked statuses, but the lifecycle lock is enforced server-side — the
 * form is convenience, never the security boundary. File replacement
 * stays on the document page (versions); visibility has its own control.
 */
export function DocumentEditForm({
  doc,
  categories,
  batches,
}: {
  doc: Document;
  categories: ReadonlyArray<DocumentCategory>;
  batches: ReadonlyArray<Batch>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    (_previous: ArchiveActionResult, formData: FormData) =>
      updateDocumentAction(formData),
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
      <input type="hidden" name="id" value={doc.id} />
      {!state.ok && state.error !== "" ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="edit-title" className={LABEL_CLASSES}>
          Title
        </label>
        <input
          id="edit-title"
          name="title"
          type="text"
          required
          disabled={pending}
          defaultValue={doc.title}
          className={INPUT_CLASSES}
        />
        <FieldError message={fieldErrors?.title} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-category" className={LABEL_CLASSES}>
            Category
          </label>
          <select
            id="edit-category"
            name="categoryId"
            required
            disabled={pending}
            defaultValue={doc.categoryId}
            className={INPUT_CLASSES}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors?.categoryId} />
        </div>
        <div>
          <label htmlFor="edit-batch" className={LABEL_CLASSES}>
            Batch
          </label>
          <select
            id="edit-batch"
            name="batchId"
            disabled={pending}
            defaultValue={doc.batchId ?? ""}
            className={INPUT_CLASSES}
          >
            <option value="">No batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors?.batchId} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-year" className={LABEL_CLASSES}>
            Year
          </label>
          <input
            id="edit-year"
            name="year"
            type="number"
            inputMode="numeric"
            disabled={pending}
            defaultValue={doc.year ?? ""}
            className={INPUT_CLASSES}
          />
          <FieldError message={fieldErrors?.year} />
        </div>
        <div>
          <label htmlFor="edit-supervisor" className={LABEL_CLASSES}>
            Supervisor
          </label>
          <input
            id="edit-supervisor"
            name="supervisorName"
            type="text"
            disabled={pending}
            defaultValue={doc.supervisorName ?? ""}
            className={INPUT_CLASSES}
          />
          <FieldError message={fieldErrors?.supervisorName} />
        </div>
      </div>

      <div>
        <label htmlFor="edit-description" className={LABEL_CLASSES}>
          Description
        </label>
        <textarea
          id="edit-description"
          name="description"
          rows={3}
          disabled={pending}
          defaultValue={doc.description ?? ""}
          className={INPUT_CLASSES}
        />
        <FieldError message={fieldErrors?.description} />
      </div>

      <div>
        <label htmlFor="edit-abstract" className={LABEL_CLASSES}>
          Abstract
        </label>
        <textarea
          id="edit-abstract"
          name="abstract"
          rows={4}
          disabled={pending}
          defaultValue={doc.abstract ?? ""}
          className={INPUT_CLASSES}
        />
        <FieldError message={fieldErrors?.abstract} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-keywords" className={LABEL_CLASSES}>
            Keywords
          </label>
          <input
            id="edit-keywords"
            name="keywords"
            type="text"
            disabled={pending}
            defaultValue={(doc.keywords ?? []).join(", ")}
            className={INPUT_CLASSES}
            placeholder="Comma-separated"
          />
          <FieldError message={fieldErrors?.keywords} />
        </div>
        <div className="flex items-start gap-2 pt-7">
          <input
            id="edit-allow-download"
            name="allowDownload"
            type="checkbox"
            disabled={pending}
            defaultChecked={doc.allowDownload}
            className="mt-1 h-4 w-4 rounded border-zinc-300"
          />
          <label htmlFor="edit-allow-download" className="text-sm text-zinc-700">
            Allow downloads
            <span className="block text-zinc-500">
              Readers may download the file once approved.
            </span>
          </label>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
