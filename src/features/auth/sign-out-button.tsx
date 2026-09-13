"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { signOutAction } from "./actions";

/**
 * Client-side sign-out trigger. The session is cleared server-side by the
 * action (no manual token handling); afterwards we navigate home.
 */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await signOutAction();
          router.replace(
            result.ok && result.destination
              ? result.destination
              : routes.public.signIn,
          );
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className={cn(
        "inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
