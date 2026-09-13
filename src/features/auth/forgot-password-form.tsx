"use client";

import { useActionState } from "react";
import {
  requestPasswordResetAction,
  type AuthActionResult,
} from "./actions";

const INITIAL_STATE: AuthActionResult = { ok: false, error: "" };

const inputClassName =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900 " +
  "focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    (_previous: AuthActionResult, formData: FormData) =>
      requestPasswordResetAction({
        email: String(formData.get("email") ?? ""),
      }),
    INITIAL_STATE,
  );

  // The success message is intentionally identical whether or not the
  // address belongs to an account (enumeration hygiene).
  if (state.ok) {
    return (
      <p
        role="status"
        className="mt-8 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
      >
        If an account exists for that address, a reset link is on its way.
        The link expires after a short time.
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="mt-8 flex flex-col gap-5">
      <div>
        <label
          htmlFor="reset-email"
          className="mb-1 block text-sm font-medium text-zinc-900"
        >
          Email
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className={inputClassName}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
