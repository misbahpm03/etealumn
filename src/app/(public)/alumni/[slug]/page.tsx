import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { createPublicDirectoryService } from "@/infrastructure/supabase/server-session";
import { ValidationError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { isValidSlug } from "@/lib/slug";
import type { PublicProfileDetail } from "@/types";

/**
 * Caching: force-dynamic — a member going private must disappear
 * immediately, and no shared cache may retain their details.
 */
export const dynamic = "force-dynamic";

interface ProfileParams {
  slug: string;
}

async function loadProfile(slug: string): Promise<PublicProfileDetail | null> {
  // Fail fast on malformed slugs without touching infrastructure (the
  // service re-validates regardless — this is only a cheap route gate).
  if (!isValidSlug(slug)) return null;
  try {
    const directory = await createPublicDirectoryService();
    return await directory.getPublicProfileDetail(slug);
  } catch (error) {
    // Malformed slugs read as not-found (no oracle, no 500).
    if (error instanceof ValidationError) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ProfileParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  // 404 here (not just a fallback title) so the status engages before the
  // page shell streams; the page-level notFound() below is the backstop.
  if (!profile) notFound();
  const name = profile.displayName ?? profile.fullName;
  const headline = [profile.currentDesignation, profile.currentCompany]
    .filter((part) => part !== null && part !== "")
    .join(" · ");
  return {
    title: `${name} — Alumni`,
    description:
      headline !== "" ? headline : `Public profile of ${name}.`,
  };
}

const ROLE_LABELS: Record<PublicProfileDetail["role"], string> = {
  ALUMNI: "Alumnus",
  STUDENT: "Student",
  FACULTY: "Faculty",
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<ProfileParams>;
}) {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) notFound();

  const name = profile.displayName ?? profile.fullName;
  const headline = [profile.currentDesignation, profile.currentCompany]
    .filter((part) => part !== null && part !== "")
    .join(" · ");
  const socials = [
    ["Website", profile.websiteUrl],
    ["LinkedIn", profile.linkedinUrl],
    ["Facebook", profile.facebookUrl],
    ["GitHub", profile.githubUrl],
  ].filter(([, url]) => url !== null) as Array<[string, string]>;

  return (
    <Container className="py-10">
      <Link
        href={routes.public.alumni}
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none"
      >
        ← Back to directory
      </Link>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row">
        {profile.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={routes.public.alumniPhoto(profile.slug)}
            alt={`Photo of ${name}`}
            width={160}
            height={160}
            className="h-40 w-40 shrink-0 rounded-xl bg-zinc-100 object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-40 w-40 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-5xl font-semibold text-zinc-500"
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-900">{name}</h1>
            <Badge>{ROLE_LABELS[profile.role]}</Badge>
          </div>
          {headline !== "" && (
            <p className="mt-1 text-base text-zinc-600">{headline}</p>
          )}
          <ProfileFacts profile={profile} />
        </div>
      </div>

      {profile.bio && (
        <section aria-label="About" className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">About</h2>
          <p className="mt-2 max-w-3xl text-sm whitespace-pre-line text-zinc-700">
            {profile.bio}
          </p>
        </section>
      )}

      {profile.careerSummary && (
        <section aria-label="Career summary" className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Career</h2>
          <p className="mt-2 max-w-3xl text-sm whitespace-pre-line text-zinc-700">
            {profile.careerSummary}
          </p>
        </section>
      )}

      {profile.work.length > 0 && (
        <section aria-label="Work experience" className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Experience</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {profile.work.map((item, index) => (
              <li key={`${item.company}-${index}`}>
                <Card className="p-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    {item.designation ?? item.company}
                  </p>
                  {item.designation && (
                    <p className="text-sm text-zinc-600">{item.company}</p>
                  )}
                  <WorkDates
                    start={item.startDate}
                    end={item.endDate}
                    isCurrent={item.isCurrent}
                  />
                  {item.location && (
                    <p className="mt-1 text-sm text-zinc-500">{item.location}</p>
                  )}
                  {item.description && (
                    <p className="mt-2 text-sm whitespace-pre-line text-zinc-700">
                      {item.description}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.education.length > 0 && (
        <section aria-label="Education" className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Education</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {profile.education.map((item, index) => (
              <li key={`${item.institution}-${index}`}>
                <Card className="p-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    {item.institution}
                  </p>
                  {[item.degree, item.fieldOfStudy]
                    .filter((part) => part !== null && part !== "")
                    .join(" · ") !== "" && (
                    <p className="text-sm text-zinc-600">
                      {[item.degree, item.fieldOfStudy]
                        .filter((part) => part !== null && part !== "")
                        .join(" · ")}
                    </p>
                  )}
                  {(item.startYear ?? item.endYear) && (
                    <p className="mt-1 text-sm text-zinc-500">
                      {[item.startYear, item.endYear]
                        .filter((part) => part !== null)
                        .join(" – ")}
                    </p>
                  )}
                  {item.description && (
                    <p className="mt-2 text-sm whitespace-pre-line text-zinc-700">
                      {item.description}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(profile.email ?? profile.phone ?? socials.length > 0) && (
        <section aria-label="Contact" className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Contact</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {profile.email && (
              <li>
                Email:{" "}
                <a
                  href={`mailto:${profile.email}`}
                  className="font-medium text-zinc-900 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none"
                >
                  {profile.email}
                </a>
              </li>
            )}
            {profile.phone && <li>Phone: {profile.phone}</li>}
            {socials.map(([label, url]) => (
              <li key={label}>
                {label}:{" "}
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium break-all text-zinc-900 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}

function ProfileFacts({ profile }: { profile: PublicProfileDetail }) {
  const facts: Array<{ label: string; value: string; href?: string }> = [];
  if (profile.batchName) {
    facts.push({
      label: "Batch",
      value: profile.batchName,
      ...(profile.batchId
        ? { href: routes.public.batchDetail(profile.batchId) }
        : {}),
    });
  }
  if (profile.graduationYear) {
    facts.push({
      label: profile.role === "STUDENT" ? "Expected graduation" : "Graduated",
      value: String(profile.graduationYear),
    });
  }
  if (profile.location) facts.push({ label: "Location", value: profile.location });
  if (profile.workLocation) {
    facts.push({ label: "Based in", value: profile.workLocation });
  }
  if (facts.length === 0) return null;
  return (
    <dl className="mt-3 space-y-1 text-sm">
      {facts.map((fact) => (
        <div key={fact.label} className="flex gap-2">
          <dt className="w-32 shrink-0 text-zinc-500">{fact.label}</dt>
          <dd className="text-zinc-800">
            {fact.href ? (
              <Link
                href={fact.href}
                className="font-medium text-zinc-900 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none"
              >
                {fact.value}
              </Link>
            ) : (
              fact.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function WorkDates({
  start,
  end,
  isCurrent,
}: {
  start: string | null;
  end: string | null;
  isCurrent: boolean;
}) {
  if (!start && !end && !isCurrent) return null;
  const range = [start, isCurrent ? "Present" : end]
    .filter((part) => part !== null)
    .join(" – ");
  if (range === "") return null;
  return <p className="mt-1 text-sm text-zinc-500">{range}</p>;
}
