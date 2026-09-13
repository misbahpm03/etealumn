/** Shared shape for navigation links across all three surfaces. */
export interface NavItem {
  href: string;
  label: string;
  /** Short description used for aria-labels and supplementary UI. */
  description?: string;
}
