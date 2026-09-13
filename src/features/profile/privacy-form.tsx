"use client";

import { useActionState } from "react";
import type { ProfilePrivacy } from "@/types";
import { updatePrivacyAction, type ProfileActionResult } from "./actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const INITIAL_STATE: ProfileActionResult = { ok: false, error: "" };

const FLAGS = [
  { name: "showEmail", label: "Email address", hint: "Show in the member directory." },
  { name: "showPhone", label: "Phone number", hint: "Show in the member directory." },
  { name: "showLocation", label: "Location", hint: "Show on directory listings." },
  { name: "showBio", label: "Bio", hint: "Show on directory listings." },
  { name: "showCareer", label: "Career history", hint: "Future directory career display." },
  { name: "showEducation", label: "Education history", hint: "Future directory education display." },
  { name: "showSocialLinks", label: "Social links", hint: "Show website and social URLs." },
  {
    name: "showProfilePublicly",
    label: "Public listing",
    hint: "Allow anonymous visitors to see the public listing (also requires Public visibility).",
  },
] as const;

export function PrivacyForm({ privacy }: { privacy: ProfilePrivacy | null }) {
  const [state, formAction, pending] = useActionState(
    (_previous: ProfileActionResult, formData: FormData) =>
      updatePrivacyAction(formData),
    INITIAL_STATE,
  );
  useRefreshOnSuccess(state);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.ok ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Privacy settings saved.
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

      <p className="text-sm text-zinc-600">
        These switches are enforced inside the database directory views — not
        just hidden in the interface. Changes are audit-logged.
      </p>

      <ul className="flex flex-col gap-3">
        {FLAGS.map((flag) => (
          <li
            key={flag.name}
            className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2"
          >
            <input
              id={`privacy-${flag.name}`}
              name={flag.name}
              type="checkbox"
              disabled={pending}
              defaultChecked={privacy?.[flag.name] ?? false}
              className="mt-1 h-4 w-4 accent-zinc-900"
            />
            <div>
              <label
                htmlFor={`privacy-${flag.name}`}
                className="block text-sm font-medium text-zinc-900"
              >
                {flag.label}
              </label>
              <p className="text-sm text-zinc-500">{flag.hint}</p>
            </div>
          </li>
        ))}
      </ul>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {pending ? "Saving…" : "Save privacy settings"}
        </button>
      </div>
    </form>
  );
}
