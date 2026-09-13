import { routes } from "@/lib/routes";
import type { NavItem } from "../navigation";

/** Admin CMS navigation (admins + moderators with scoped permissions). */
export const adminNavItems: ReadonlyArray<NavItem> = [
  { href: routes.admin.dashboard, label: "Dashboard" },
  { href: routes.admin.users, label: "Users" },
  { href: routes.admin.batches, label: "Batches" },
  { href: routes.admin.archive, label: "Academic Archive" },
  { href: routes.admin.stories, label: "Stories" },
  { href: routes.admin.achievements, label: "Achievements" },
  { href: routes.admin.opportunities, label: "Opportunities" },
  { href: routes.admin.mentorship, label: "Mentorship" },
  { href: routes.admin.memory, label: "Department Memory" },
  { href: routes.admin.notifications, label: "Notifications" },
  { href: routes.admin.auditLogs, label: "Audit Logs" },
  { href: routes.admin.settings, label: "System Settings" },
];
