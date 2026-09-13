/**
 * Central route-path constants. Prefer these over string literals so route
 * renames stay safe and navigation configs can't drift out of sync.
 */
export const routes = {
  public: {
    home: "/",
    about: "/about",
    alumni: "/alumni",
    batches: "/batches",
    archive: "/archive",
    stories: "/stories",
    achievements: "/achievements",
    memory: "/memory",
    signIn: "/signin",
  },
  portal: {
    root: "/portal",
    dashboard: "/portal/dashboard",
    profile: "/portal/profile",
    archive: "/portal/archive",
    opportunities: "/portal/opportunities",
    mentorship: "/portal/mentorship",
    stories: "/portal/stories",
    achievements: "/portal/achievements",
    batch: "/portal/batch",
    notifications: "/portal/notifications",
    settings: "/portal/settings",
  },
  admin: {
    root: "/admin",
    dashboard: "/admin/dashboard",
    users: "/admin/users",
    batches: "/admin/batches",
    archive: "/admin/archive",
    stories: "/admin/stories",
    achievements: "/admin/achievements",
    opportunities: "/admin/opportunities",
    mentorship: "/admin/mentorship",
    memory: "/admin/memory",
    notifications: "/admin/notifications",
    auditLogs: "/admin/audit-logs",
    settings: "/admin/settings",
  },
  api: {
    health: "/api/health",
  },
} as const;
