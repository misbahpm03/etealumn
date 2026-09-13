"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ProfileActionResult } from "./actions";

/** Re-render server data after an in-place save (actions revalidate). */
export function useRefreshOnSuccess(state: ProfileActionResult): void {
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);
}
