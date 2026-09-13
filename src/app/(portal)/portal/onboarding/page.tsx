import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import {
  createProfileService,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Onboarding" };

const linkClassName =
  "rounded text-sm font-medium text-zinc-900 underline hover:text-zinc-600 " +
  "focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Derived onboarding checklist — every step is computed from live records
 * (no stored completion flag to forge or desync). Completing onboarding
 * never changes status or role; activation stays administrative.
 */
export default async function PortalOnboardingPage() {
  const appUser = await requireActiveUser();
  const service = await createProfileService(appUser);
  const state = await service.getOnboardingState();

  const steps: Array<{
    done: boolean;
    label: string;
    href: string;
    optional?: boolean;
  }> = [
    {
      done: state.hasCustomName,
      label: "Personalize your display name",
      href: routes.portal.profileEdit,
    },
    {
      done: state.hasPhoto,
      label: "Upload a profile photo",
      href: routes.portal.profileEdit,
    },
    ...(state.roleProfileRequired
      ? [
          {
            done: state.hasRoleProfile,
            label:
              state.role === "STUDENT"
                ? "Complete your student record"
                : "Complete your alumni record",
            href: routes.portal.profileAcademic,
          },
        ]
      : []),
    {
      done: state.workCount > 0,
      label: `Add work experience (${state.workCount} so far)`,
      href: routes.portal.profileCareer,
      optional: true,
    },
    {
      done: state.educationCount > 0,
      label: `Add education (${state.educationCount} so far)`,
      href: routes.portal.profileCareer,
      optional: true,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="Finish setting up your profile"
        description="Required steps unlock the full member experience; career entries are optional."
      />

      {state.complete ? (
        <p
          role="status"
          className="mt-8 max-w-2xl rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Your profile is complete — welcome aboard.
        </p>
      ) : null}

      <ul className="mt-8 flex max-w-2xl flex-col gap-3">
        {steps.map((step) => (
          <li
            key={step.label}
            className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3"
          >
            <span className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className={
                  step.done
                    ? "flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white"
                    : "flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 text-xs text-zinc-400"
                }
              >
                {step.done ? "✓" : "·"}
              </span>
              <span className="font-medium text-zinc-900">
                {step.label}
                {step.optional ? (
                  <span className="ml-2 text-zinc-500">(optional)</span>
                ) : null}
              </span>
            </span>
            <span className="sr-only">{step.done ? "done" : "not done"}</span>
            {step.done ? null : (
              <Link href={step.href} className={linkClassName}>
                {step.label.startsWith("Add") ? "Add" : "Go"}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
