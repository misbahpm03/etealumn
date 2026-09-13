import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import {
  removeEducationAction,
  removeWorkExperienceAction,
} from "@/features/profile/actions";
import { EducationForm } from "@/features/profile/education-form";
import { RemoveEntryButton } from "@/features/profile/remove-entry-button";
import { WorkForm } from "@/features/profile/work-form";
import {
  createProfileService,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Career & Education" };

const linkClassName =
  "rounded text-sm font-medium text-zinc-900 underline hover:text-zinc-600 " +
  "focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Own work/education management. Edit targets (`?edit=work:<id>`) resolve
 * against the caller's OWN already-loaded lists — an id that is not theirs
 * simply matches nothing (no oracle, no cross-user read).
 */
export default async function PortalCareerPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const appUser = await requireActiveUser();
  const service = await createProfileService(appUser);
  const [work, education] = await Promise.all([
    service.listWorkExperience(),
    service.listEducation(),
  ]);
  const { edit } = await searchParams;
  const [kind, id] = (edit ?? "").split(":");
  const editingWork =
    kind === "work" ? (work.find((entry) => entry.id === id) ?? null) : null;
  const editingEducation =
    kind === "edu" ? (education.find((entry) => entry.id === id) ?? null) : null;

  return (
    <>
      <PageHeader
        eyebrow="My Profile"
        title="Career & education"
        description="Entries only you can manage; directory visibility follows your privacy flags."
      />

      <div className="mt-8 flex max-w-2xl flex-col gap-12">
        <section aria-label="Work experience">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            Work experience
          </h2>
          {work.length === 0 ? (
            <p className="mb-6 text-sm text-zinc-600">No entries yet.</p>
          ) : (
            <ul className="mb-6 flex flex-col gap-3">
              {work.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-medium text-zinc-900">
                      {entry.company}
                    </span>
                    {entry.designation ? (
                      <span className="text-zinc-600">
                        {" "}
                        — {entry.designation}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Link
                      href={`${routes.portal.profileCareer}?edit=work:${entry.id}`}
                      className={linkClassName}
                    >
                      Edit
                    </Link>
                    <RemoveEntryButton
                      id={entry.id}
                      label="work entry"
                      action={removeWorkExperienceAction}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editingWork ? (
            <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                Edit entry
              </h3>
              <WorkForm entry={editingWork} />
              <p className="mt-4 text-sm">
                <Link
                  href={routes.portal.profileCareer}
                  className={linkClassName}
                >
                  Cancel editing
                </Link>
              </p>
            </div>
          ) : (
            <div>
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                Add entry
              </h3>
              <WorkForm />
            </div>
          )}
        </section>

        <section aria-label="Education">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            Education
          </h2>
          {education.length === 0 ? (
            <p className="mb-6 text-sm text-zinc-600">No entries yet.</p>
          ) : (
            <ul className="mb-6 flex flex-col gap-3">
              {education.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-medium text-zinc-900">
                      {entry.institution}
                    </span>
                    {entry.degree ? (
                      <span className="text-zinc-600"> — {entry.degree}</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Link
                      href={`${routes.portal.profileCareer}?edit=edu:${entry.id}`}
                      className={linkClassName}
                    >
                      Edit
                    </Link>
                    <RemoveEntryButton
                      id={entry.id}
                      label="education entry"
                      action={removeEducationAction}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editingEducation ? (
            <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                Edit entry
              </h3>
              <EducationForm entry={editingEducation} />
              <p className="mt-4 text-sm">
                <Link
                  href={routes.portal.profileCareer}
                  className={linkClassName}
                >
                  Cancel editing
                </Link>
              </p>
            </div>
          ) : (
            <div>
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                Add entry
              </h3>
              <EducationForm />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
