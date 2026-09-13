"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary. Surfaces a safe message (never error internals)
 * with recovery actions. Feature-specific boundaries arrive with features.
 */
export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Structured logging replaces this in a later phase.
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <Container narrow className="py-16">
      <Card>
        <p className="text-xs font-semibold tracking-widest text-red-700 uppercase">
          Something went wrong
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
          We couldn&apos;t load this page
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          An unexpected error occurred. You can try again, or return to the
          home page. If the problem persists, please contact the site
          administrator.
          {error.digest ? (
            <span className="mt-2 block font-mono text-xs text-zinc-500">
              Reference: {error.digest}
            </span>
          ) : null}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button href={routes.public.home} variant="secondary">
            Go to home page
          </Button>
        </div>
      </Card>
    </Container>
  );
}
