"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/features/auth/sign-out-button";
import type { NavItem } from "@/features/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  /** Surface label shown in the sidebar and top bar. */
  title: string;
  /** Short brand mark, e.g. "Portal" or "Admin". */
  brandMark: string;
  /** Where the brand links back to (usually the surface dashboard). */
  homeHref: string;
  items: ReadonlyArray<NavItem>;
  children: React.ReactNode;
}

/**
 * Shared authenticated shell for the member portal and admin CMS:
 * persistent sidebar on desktop, slide-over navigation on mobile, and a
 * top bar. Keeps the two surfaces visually consistent without duplicating
 * chrome code.
 */
export function DashboardShell({
  title,
  brandMark,
  homeHref,
  items,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // Close the mobile drawer with Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const navList = (label: string) => (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={closeMenu}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 focus-visible:outline-none",
                  isActive
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-0 px-0 sm:px-6 lg:gap-8 lg:px-8">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50 py-6 pr-6 lg:block">
        <Link
          href={homeHref}
          className="mb-6 flex items-center gap-3 rounded-md px-3 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label={`${title} — dashboard`}
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900 text-xs font-bold text-white"
          >
            {brandMark}
          </span>
          <span className="text-sm font-semibold text-zinc-900">{title}</span>
        </Link>
        {navList(`${title} navigation`)}
        <div className="mt-6 border-t border-zinc-200 px-3 pt-4">
          <SignOutButton className="w-full" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur sm:px-0 lg:hidden">
          <span className="truncate text-sm font-semibold text-zinc-900">
            {title}
          </span>
          <button
            type="button"
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-expanded={menuOpen}
            aria-controls="dashboard-mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
            Menu
          </button>
        </div>

        {menuOpen ? (
          <div
            id="dashboard-mobile-navigation"
            className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6 lg:hidden"
          >
            {navList(`${title} mobile navigation`)}
            <div className="mt-4">
              <SignOutButton className="w-full" />
            </div>
          </div>
        ) : null}

        <main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-0 lg:py-8">{children}</main>

        <p className="border-t border-zinc-200 px-4 py-4 text-xs text-zinc-500 sm:px-0">
          <Link
            href={routes.public.home}
            className="rounded hover:text-zinc-900 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            ← Back to public website
          </Link>
        </p>
      </div>
    </div>
  );
}
