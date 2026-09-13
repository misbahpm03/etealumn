import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Accessible label announced to screen readers. */
  label?: string;
  className?: string;
}

/** Standard loading indicator with an aria-live announcement. */
export function LoadingState({
  label = "Loading…",
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("flex items-center justify-center gap-3 py-16", className)}
    >
      <span
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"
      />
      <span className="text-sm font-medium text-zinc-600">{label}</span>
    </div>
  );
}
