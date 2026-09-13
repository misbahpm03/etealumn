import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";

const exploreLinks = [
  {
    href: routes.public.about,
    title: "About",
    description: "The department, its mission, and this platform.",
  },
  {
    href: routes.public.alumni,
    title: "Alumni",
    description: "Graduates across batches, industries, and countries.",
  },
  {
    href: routes.public.batches,
    title: "Batches",
    description: "Browse cohorts by admission and graduation year.",
  },
  {
    href: routes.public.archive,
    title: "Archive",
    description: "Approved theses, papers, and project reports.",
  },
  {
    href: routes.public.stories,
    title: "Stories",
    description: "Journeys and reflections from the community.",
  },
  {
    href: routes.public.achievements,
    title: "Achievements",
    description: "Awards and milestones worth celebrating.",
  },
  {
    href: routes.public.memory,
    title: "Department Memory",
    description: "Milestones and moments from department history.",
  },
];

/** Public home page (Phase 1: structure only, content arrives later). */
export default function HomePage() {
  return (
    <Container className="py-10 sm:py-14">
      <section aria-labelledby="home-heading" className="max-w-3xl">
        <Badge tone="info">Department platform</Badge>
        <h1
          id="home-heading"
          className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 text-balance sm:text-5xl"
        >
          {siteConfig.name}
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600">
          {siteConfig.description} This public website will surface only
          content that is explicitly approved and publicly visible.
        </p>
      </section>

      <section aria-labelledby="explore-heading" className="mt-12">
        <h2
          id="explore-heading"
          className="text-xl font-semibold tracking-tight text-zinc-900"
        >
          Explore the department
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exploreLinks.map((link) => (
            <li key={link.href}>
              <Card className="h-full transition-colors hover:border-zinc-300">
                <Link
                  href={link.href}
                  className="block rounded-md focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
                  aria-label={`${link.title} — ${link.description}`}
                >
                  <span className="text-base font-semibold text-zinc-900">
                    {link.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-zinc-600">
                    {link.description}
                  </span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
