"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { routes } from "@/lib/routes";
import { updatePasswordAction, type AuthActionResult } from "./actions";

const INITIAL_STATE: AuthActionResult = { ok: false, error: "" };

const inputClassName =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900 " +
  "focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60";

export function ResetPasswordForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    (_previous: AuthActionResult, formData: FormData) => {
      const password = String(formData.get("password") ?? "");
      const confirm = String(formData.get("confirmPassword") ?? "");
      if (password !== confirm) {
        return Promise.resolve<AuthActionResult>({
          ok: false,
          error: "The passwords do not match.",
        });
      }
      return updatePasswordAction({ password });
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      router.replace(state.destination ?? routes.public.signIn);
    }
  }, [state, router]);

  return (
    <form action={formAction} noValidate className="mt-8 flex flex-col gap-5">
      {!state.ok && state.error !== "" ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label
          htmlFor="new-password"
          className="mb-1 block text-sm font-medium text-zinc-900"
        >
          New password
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
          className={inputClassName}
        />
        <p className="mt-1 text-sm text-zinc-500">Use at least 8 characters.</p>
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="mb-1 block text-sm font-medium text-zinc-900"
        >
          Confirm new password
        </label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
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
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
