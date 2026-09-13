import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { AlumniForm } from "@/features/profile/alumni-form";
import { StudentForm } from "@/features/profile/student-form";
import {
  createProfileService,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Academic Details" };

/**
 * Role-specific academic record. The SERVER picks which form renders from
 * the authoritative `users.role` — the browser never chooses a role lane,
 * and the service re-enforces the match on save.
 */
export default async function PortalAcademicPage() {
  const appUser = await requireActiveUser();
  const service = await createProfileService(appUser);

  if (appUser.role !== "STUDENT" && appUser.role !== "ALUMNI") {
    return (
      <>
        <PageHeader
          eyebrow="Academic details"
          title="Not applicable"
          description="Role-specific academic records apply to student and alumni accounts; your account uses the general profile."
        />
        <p className="mt-8 text-sm">
          <Link
            href={routes.portal.profile}
            className="rounded font-medium text-zinc-900 underline hover:text-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            ← Back to My Profile
          </Link>
        </p>
      </>
    );
  }

  const [batches, student, alumni] = await Promise.all([
    service.listBatches(),
    appUser.role === "STUDENT" ? service.getCurrentStudentProfile() : null,
    appUser.role === "ALUMNI" ? service.getCurrentAlumniProfile() : null,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Academic details"
        title={
          appUser.role === "STUDENT" ? "Student record" : "Alumni record"
        }
        description="Saved through an audited server-side operation; batch links are validated against real batches."
      />
      <div className="mt-8 max-w-2xl">
        {appUser.role === "STUDENT" ? (
          <StudentForm student={student} batches={batches} />
        ) : (
          <AlumniForm alumni={alumni} batches={batches} />
        )}
      </div>
    </>
  );
}
