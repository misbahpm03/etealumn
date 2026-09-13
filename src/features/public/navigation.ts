import { routes } from "@/lib/routes";
import type { NavItem } from "../navigation";

/**
 * Public website navigation. Deliberately excludes Opportunities and
 * Mentorship (member-only), registration CTAs, and featured-alumni promos —
 * those are out of the approved public scope.
 */
export const publicNavItems: ReadonlyArray<NavItem> = [
  { href: routes.public.home, label: "Home" },
  { href: routes.public.about, label: "About" },
  { href: routes.public.alumni, label: "Alumni" },
  { href: routes.public.batches, label: "Batches" },
  { href: routes.public.archive, label: "Archive" },
  { href: routes.public.stories, label: "Stories" },
  { href: routes.public.achievements, label: "Achievements" },
  { href: routes.public.memory, label: "Department Memory" },
];

export const signInNavItem: NavItem = {
  href: routes.public.signIn,
  label: "Sign In",
};
