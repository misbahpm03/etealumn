"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { routes } from "@/lib/routes";
import { signInAction, type AuthActionResult } from "./actions";

const INITIAL_STATE: AuthActionResult = { ok: false, error: "" };

const inputClassName =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900 " +
  "focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60";

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    (_previous: AuthActionResult, formData: FormData) =>
      signInAction({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        next,
      }),
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      router.replace(state.destination ?? routes.portal.dashboard);
    }
  }, [state, router]);

  const fieldErrors =
    !state.ok && state.fieldErrors ? state.fieldErrors : undefined;

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
          htmlFor="signin-email"
          className="mb-1 block text-sm font-medium text-zinc-900"
        >
          Email
        </label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className={inputClassName}
          aria-invalid={fieldErrors?.email ? true : undefined}
          aria-describedby={fieldErrors?.email ? "signin-email-error" : undefined}
        />
        {fieldErrors?.email ? (
          <p id="signin-email-error" role="alert" className="mt-1 text-sm text-red-700">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="signin-password"
          className="mb-1 block text-sm font-medium text-zinc-900"
        >
          Password
        </label>
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className={inputClassName}
          aria-invalid={fieldErrors?.password ? true : undefined}
          aria-describedby={fieldErrors?.password ? "signin-password-error" : undefined}
        />
        {fieldErrors?.password ? (
          <p id="signin-password-error" role="alert" className="mt-1 text-sm text-red-700">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-sm text-zinc-600">
        <Link
          href={routes.public.forgotPassword}
          className="rounded underline hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
