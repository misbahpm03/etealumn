import Link from "next/link";
import { Card } from "@/components/ui/card";
import { routes } from "@/lib/routes";
import type { SafePublicProfile } from "@/types";

/**
 * Public directory card. Renders ONLY the safe projection (no contact
 * details on cards — those live on the detail page, still flag-gated).
 * Server component: zero client JavaScript.
 */
export function ProfileCard({ profile }: { profile: SafePublicProfile }) {
  const name = profile.displayName ?? profile.fullName;
  const headline = [profile.currentDesignation, profile.currentCompany]
    .filter((part) => part !== null && part !== "")
    .join(" · ");
  const batchLine = [
    profile.batchName,
    profile.graduationYear ? `Class of ${profile.graduationYear}` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <Card className="flex gap-4 p-4 transition-colors hover:border-zinc-400">
      {profile.hasPhoto ? (
        // Photo bytes come from the server endpoint (eligibility-checked,
        // short-lived signed URL) — the browser never sees storage paths.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={routes.public.alumniPhoto(profile.slug)}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-full bg-zinc-100 object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xl font-semibold text-zinc-500"
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <Link
          href={routes.public.alumniProfile(profile.slug)}
          className="block truncate text-base font-semibold text-zinc-900 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none"
        >
          {name}
        </Link>
        {headline !== "" && (
          <p className="mt-0.5 truncate text-sm text-zinc-600">{headline}</p>
        )}
        {batchLine !== "" && (
          <p className="mt-0.5 truncate text-sm text-zinc-500">{batchLine}</p>
        )}
        {profile.location && (
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            {profile.location}
          </p>
        )}
      </div>
    </Card>
  );
}
