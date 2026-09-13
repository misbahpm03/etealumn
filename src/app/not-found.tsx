import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Page not found" };

/** Global 404 page. */
export default function NotFound() {
  return (
    <Container narrow className="py-16">
      <EmptyState
        title="Page not found"
        description="The page you are looking for does not exist or may have been moved."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button href={routes.public.home}>Go to home page</Button>
            <Button href={routes.portal.dashboard} variant="secondary">
              Open member portal
            </Button>
          </div>
        }
      />
    </Container>
  );
}
