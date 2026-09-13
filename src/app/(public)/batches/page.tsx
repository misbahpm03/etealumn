import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createPublicBatchService } from "@/infrastructure/supabase/server-session";
import { routes } from "@/lib/routes";

/** Force-dynamic: batch membership visibility must always read live. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Batches" };

export default async function BatchesPage() {
  const batches = await createPublicBatchService();
  const rows = await batches.listPublicBatches();

  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="Community"
        title="Batches"
        description="Cohorts by admission and graduation year."
      />
      <div className="mt-8">
        {rows.length === 0 ? (
          <EmptyState
            title="No batches yet"
            description="Batch records are published here by the department."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {rows.map((batch) => (
              <li key={batch.id}>
                <Card className="p-4 transition-colors hover:border-zinc-400">
                  <Link
                    href={routes.public.batchDetail(batch.id)}
                    className="text-base font-semibold text-zinc-900 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none"
                  >
                    {batch.name}
                  </Link>
                  <BatchYears
                    admissionYear={batch.admissionYear}
                    graduationYear={batch.graduationYear}
                  />
                  {batch.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-zinc-600">
                      {batch.description}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}

function BatchYears({
  admissionYear,
  graduationYear,
}: {
  admissionYear: number | null;
  graduationYear: number | null;
}) {
  const range = [admissionYear, graduationYear]
    .filter((part) => part !== null)
    .join(" – ");
  if (range === "") return null;
  return <p className="mt-0.5 text-sm text-zinc-500">{range}</p>;
}
