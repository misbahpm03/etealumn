/**
 * Canonical site metadata. Single source of truth for titles, descriptions,
 * and institutional labels used across the public site, portal, and admin CMS.
 */
export const siteConfig = {
  name: "ETE Alumni & Academic Archive",
  shortName: "ETE Alumni",
  description:
    "The official alumni network and academic archive of the Department of ETE — connecting students, alumni, and faculty across generations.",
  department: "Department of Electronics and Telecommunication Engineering",
  institution: "University",
} as const;

export type SiteConfig = typeof siteConfig;
