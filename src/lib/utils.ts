import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class lists, resolving conflicts (e.g. `px-2` + `px-4`
 * keeps only `px-4`). Use for every component that accepts `className`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
