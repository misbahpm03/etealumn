import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import {
  createProfileService,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "My Profile" };

const linkClassName =
  "rounded text-sm font-medium text-zinc-900 underline hover:text-zinc-600 " +
  "focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none";

const sectionClassName = "rounded-lg border border-zinc-200 bg-white p-5";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm font-medium text-zinc-500">
        {label}
      </dt>
      <dd className="text-sm text-zinc-900">{value}</dd>
    </div>
  );
}

export default async function PortalProfilePage() {
  const appUser = await requireActiveUser();
  const service = await createProfileService(appUser);
  await service.ensureInitialized();
  const [profile, privacy, batch, work, education, photoAccess, onboarding] =
    await Promise.all([
      service.getCurrentProfile(),
      service.getCurrentPrivacy(),
      service.getCurrentBatch(),
      service.listWorkExperience(),
      service.listEducation(),
      service.getProfilePhotoAccess(),
      service.getOnboardingState(),
    ]);
  const student =
    appUser.role === "STUDENT"
      ? await service.getCurrentStudentProfile()
      : null;
  const alumni =
    appUser.role === "ALUMNI"
      ? await service.getCurrentAlumniProfile()
      : null;

  const rawSocials: Array<[string, string | null]> = [
    ["Website", profile?.websiteUrl ?? null],
    ["LinkedIn", profile?.linkedinUrl ?? null],
    ["Facebook", profile?.facebookUrl ?? null],
    ["GitHub", profile?.githubUrl ?? null],
  ];
  const socials = rawSocials.filter(([, url]) => url !== null);

  return (
    <>
      <PageHeader
        eyebrow={`${appUser.role} · ${appUser.status}`}
        title={profile?.fullName ?? "My Profile"}
        description="Your portal identity, academic record, career history, and privacy."
      />

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <Link href={routes.portal.profileEdit} className={linkClassName}>
          Edit profile & privacy
        </Link>
        <Link href={routes.portal.profileAcademic} className={linkClassName}>
          Academic details
        </Link>
        <Link href={routes.portal.profileCareer} className={linkClassName}>
          Career & education
        </Link>
        <Link href={routes.portal.onboarding} className={linkClassName}>
          {onboarding.complete ? "Onboarding complete ✓" : "Continue onboarding"}
        </Link>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section aria-label="Profile" className={sectionClassName}>
          <div className="flex items-center gap-4">
            {photoAccess ? (
              // Signed URL minted for this request only — never stored.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoAccess.url}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-xl font-bold text-zinc-500"
              >
                {(profile?.fullName ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-zinc-900">
                {profile?.displayName || profile?.fullName || "—"}
              </p>
              <p className="text-sm text-zinc-500">{appUser.email}</p>
            </div>
          </div>
          <dl className="mt-4 divide-y divide-zinc-100">
            <Row label="Bio" value={profile?.bio || "—"} />
            <Row label="Phone" value={profile?.phone || "—"} />
            <Row label="Location" value={profile?.location || "—"} />
            <Row
              label="Visibility"
              value={profile?.profileVisibility ?? "—"}
            />
            {socials.map(([label, url]) => (
              <Row key={label} label={label} value={url as string} />
            ))}
          </dl>
        </section>

        <section aria-label="Academic record" className={sectionClassName}>
          <h2 className="text-base font-semibold text-zinc-900">
            Academic record
          </h2>
          {student ? (
            <dl className="mt-2 divide-y divide-zinc-100">
              <Row label="Student ID" value={student.studentId} />
              <Row label="Batch" value={batch?.name ?? "—"} />
              <Row
                label="Enrollment"
                value={student.enrollmentYear?.toString() ?? "—"}
              />
              <Row
                label="Expected graduation"
                value={student.expectedGraduationYear?.toString() ?? "—"}
              />
              <Row
                label="Semester"
                value={student.currentSemester?.toString() ?? "—"}
              />
              <Row label="Department" value={student.department || "—"} />
              <Row
                label="Academic status"
                value={student.academicStatus || "—"}
              />
            </dl>
          ) : alumni ? (
            <dl className="mt-2 divide-y divide-zinc-100">
              <Row label="Batch" value={batch?.name ?? "—"} />
              <Row
                label="Graduation"
                value={alumni.graduationYear?.toString() ?? "—"}
              />
              <Row label="Company" value={alumni.currentCompany || "—"} />
              <Row
                label="Designation"
                value={alumni.currentDesignation || "—"}
              />
              <Row label="Location" value={alumni.currentLocation || "—"} />
              <Row
                label="Mentoring"
                value={alumni.availableForMentoring ? "Available" : "No"}
              />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              {appUser.role === "STUDENT" || appUser.role === "ALUMNI"
                ? "No academic record yet — add one from Academic details."
                : "Role profiles apply to students and alumni; your account uses the general profile."}
            </p>
          )}
          {alumni?.careerSummary ? (
            <p className="mt-3 text-sm text-zinc-700">{alumni.careerSummary}</p>
          ) : null}
        </section>

        <section aria-label="Work experience" className={sectionClassName}>
          <h2 className="text-base font-semibold text-zinc-900">
            Work experience
          </h2>
          {work.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">No entries yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {work.map((entry) => (
                <li key={entry.id} className="text-sm text-zinc-900">
                  <span className="font-medium">{entry.company}</span>
                  {entry.designation ? ` — ${entry.designation}` : ""}
                  <span className="block text-zinc-500">
                    {[entry.startDate, entry.isCurrent ? "present" : entry.endDate]
                      .filter(Boolean)
                      .join(" → ") || "dates not set"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Education" className={sectionClassName}>
          <h2 className="text-base font-semibold text-zinc-900">Education</h2>
          {education.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">No entries yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {education.map((entry) => (
                <li key={entry.id} className="text-sm text-zinc-900">
                  <span className="font-medium">{entry.institution}</span>
                  {entry.degree ? ` — ${entry.degree}` : ""}
                  <span className="block text-zinc-500">
                    {[entry.startYear, entry.endYear]
                      .filter((y) => y !== null)
                      .join(" → ") || "years not set"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Privacy" className={sectionClassName}>
          <h2 className="text-base font-semibold text-zinc-900">Privacy</h2>
          {privacy ? (
            <dl className="mt-2 divide-y divide-zinc-100">
              <Row label="Email" value={privacy.showEmail ? "Shown" : "Hidden"} />
              <Row label="Phone" value={privacy.showPhone ? "Shown" : "Hidden"} />
              <Row
                label="Location"
                value={privacy.showLocation ? "Shown" : "Hidden"}
              />
              <Row label="Bio" value={privacy.showBio ? "Shown" : "Hidden"} />
              <Row
                label="Career"
                value={privacy.showCareer ? "Shown" : "Hidden"}
              />
              <Row
                label="Education"
                value={privacy.showEducation ? "Shown" : "Hidden"}
              />
              <Row
                label="Social links"
                value={privacy.showSocialLinks ? "Shown" : "Hidden"}
              />
              <Row
                label="Public listing"
                value={privacy.showProfilePublicly ? "On" : "Off"}
              />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">Not configured.</p>
          )}
        </section>
      </div>
    </>
  );
}
