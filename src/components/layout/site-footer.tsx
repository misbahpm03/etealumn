import Link from "next/link";
import { siteConfig } from "@/config/site";
import { publicNavItems } from "@/features/public/navigation";

/** Public website footer. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{siteConfig.name}</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600">
            {siteConfig.description}
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="text-sm font-semibold text-zinc-900">Explore</p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {publicNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded text-sm text-zinc-600 hover:text-zinc-900 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Department</p>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            {siteConfig.department}
            <br />
            {siteConfig.institution}
          </p>
        </div>
      </div>
      <div className="border-t border-zinc-200">
        <p className="mx-auto w-full max-w-7xl px-4 py-4 text-xs text-zinc-500 sm:px-6 lg:px-8">
          © {year} {siteConfig.department}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
