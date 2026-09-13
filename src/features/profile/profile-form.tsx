"use client";

import { useActionState } from "react";
import type { Profile } from "@/types";
import { updateProfileAction, type ProfileActionResult } from "./actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const INITIAL_STATE: ProfileActionResult = { ok: false, error: "" };

const inputClassName =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900 " +
  "focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60";
const labelClassName = "mb-1 block text-sm font-medium text-zinc-900";
const fieldErrorClassName = "mt-1 text-sm text-red-700";

const VISIBILITY_OPTIONS = [
  { value: "PRIVATE", label: "Private — only me" },
  { value: "STUDENT_ONLY", label: "Students & alumni" },
  { value: "FACULTY_ONLY", label: "Faculty & staff" },
  { value: "PUBLIC", label: "Public directory listing" },
] as const;

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className={fieldErrorClassName}>
      {message}
    </p>
  );
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [state, formAction, pending] = useActionState(
    (_previous: ProfileActionResult, formData: FormData) =>
      updateProfileAction(formData),
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
          Profile saved.
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
          <label htmlFor="profile-fullName" className={labelClassName}>
            Full name
          </label>
          <input
            id="profile-fullName"
            name="fullName"
            type="text"
            required
            disabled={pending}
            defaultValue={profile?.fullName ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.fullName} />
        </div>
        <div>
          <label htmlFor="profile-displayName" className={labelClassName}>
            Display name
          </label>
          <input
            id="profile-displayName"
            name="displayName"
            type="text"
            disabled={pending}
            defaultValue={profile?.displayName ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.displayName} />
        </div>
      </div>

      <div>
        <label htmlFor="profile-bio" className={labelClassName}>
          Bio
        </label>
        <textarea
          id="profile-bio"
          name="bio"
          rows={4}
          disabled={pending}
          defaultValue={profile?.bio ?? ""}
          className={inputClassName}
        />
        <FieldError message={fieldErrors?.bio} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="profile-phone" className={labelClassName}>
            Phone
          </label>
          <input
            id="profile-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            disabled={pending}
            defaultValue={profile?.phone ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.phone} />
        </div>
        <div>
          <label htmlFor="profile-location" className={labelClassName}>
            Location
          </label>
          <input
            id="profile-location"
            name="location"
            type="text"
            disabled={pending}
            defaultValue={profile?.location ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.location} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="profile-websiteUrl" className={labelClassName}>
            Website URL
          </label>
          <input
            id="profile-websiteUrl"
            name="websiteUrl"
            type="url"
            inputMode="url"
            placeholder="https://…"
            disabled={pending}
            defaultValue={profile?.websiteUrl ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.websiteUrl} />
        </div>
        <div>
          <label htmlFor="profile-linkedinUrl" className={labelClassName}>
            LinkedIn URL
          </label>
          <input
            id="profile-linkedinUrl"
            name="linkedinUrl"
            type="url"
            inputMode="url"
            placeholder="https://…"
            disabled={pending}
            defaultValue={profile?.linkedinUrl ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.linkedinUrl} />
        </div>
        <div>
          <label htmlFor="profile-facebookUrl" className={labelClassName}>
            Facebook URL
          </label>
          <input
            id="profile-facebookUrl"
            name="facebookUrl"
            type="url"
            inputMode="url"
            placeholder="https://…"
            disabled={pending}
            defaultValue={profile?.facebookUrl ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.facebookUrl} />
        </div>
        <div>
          <label htmlFor="profile-githubUrl" className={labelClassName}>
            GitHub URL
          </label>
          <input
            id="profile-githubUrl"
            name="githubUrl"
            type="url"
            inputMode="url"
            placeholder="https://…"
            disabled={pending}
            defaultValue={profile?.githubUrl ?? ""}
            className={inputClassName}
          />
          <FieldError message={fieldErrors?.githubUrl} />
        </div>
      </div>

      <div>
        <label htmlFor="profile-visibility" className={labelClassName}>
          Profile visibility
        </label>
        <select
          id="profile-visibility"
          name="profileVisibility"
          disabled={pending}
          defaultValue={profile?.profileVisibility ?? "PRIVATE"}
          className={inputClassName}
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors?.profileVisibility} />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
