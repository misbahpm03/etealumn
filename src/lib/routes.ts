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
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    verifyEmail: "/verify-email",
    accountStatus: "/account-status",
    /** Public profile page (slug-keyed — never a user ID). */
    alumniProfile: (slug: string) => `/alumni/${slug}`,
    /** Public batch page (batch UUIDs are unguessable reference keys). */
    batchDetail: (id: string) => `/batches/${id}`,
    /** Server photo endpoint (verifies eligibility, signs short-lived URLs). */
    alumniPhoto: (slug: string) => `/api/directory/photo/${slug}`,
    /** Public document page (APPROVED + PUBLIC projection only). */
    archiveDetail: (slug: string) => `/archive/${slug}`,
  },
  portal: {
    root: "/portal",
    dashboard: "/portal/dashboard",
    onboarding: "/portal/onboarding",
    profile: "/portal/profile",
    profileEdit: "/portal/profile/edit",
    profileAcademic: "/portal/profile/academic",
    profileCareer: "/portal/profile/career",
    archive: "/portal/archive",
    archiveNew: "/portal/archive/new",
    /** Member document page (id-keyed — stable across slug edits). */
    archiveDetail: (id: string) => `/portal/archive/${id}`,
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
    /** Document download endpoint (verifies the download tree, 302s). */
    archiveDownload: (id: string) => `/api/archive/download/${id}`,
  },
  auth: {
    /** Server-side exchange endpoint for email links (verify/reset/invite). */
    callback: "/auth/callback",
  },
} as const;
