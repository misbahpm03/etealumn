import { routes } from "@/lib/routes";
import type { NavItem } from "../navigation";

/** Member portal navigation (authenticated students & alumni). */
export const portalNavItems: ReadonlyArray<NavItem> = [
  { href: routes.portal.dashboard, label: "Dashboard" },
  { href: routes.portal.onboarding, label: "Onboarding" },
  { href: routes.portal.profile, label: "My Profile" },
  { href: routes.portal.archive, label: "Academic Archive" },
  { href: routes.portal.opportunities, label: "Opportunities" },
  { href: routes.portal.mentorship, label: "Mentorship" },
  { href: routes.portal.stories, label: "Stories" },
  { href: routes.portal.achievements, label: "Achievements" },
  { href: routes.portal.batch, label: "My Batch" },
  { href: routes.portal.notifications, label: "Notifications" },
  { href: routes.portal.settings, label: "Settings" },
];
