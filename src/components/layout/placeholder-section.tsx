import { Badge } from "../ui/badge";
import { Card } from "../ui/card";

interface PlaceholderSectionProps {
  /** What will live here once the feature phase lands. */
  summary: string;
  /** Short list of planned capabilities, if any. */
  planned?: ReadonlyArray<string>;
}

/**
 * Temporary Phase 1 page body. Every placeholder route renders one of these
 * so "not built yet" is explicit and consistent — never a blank page.
 */
export function PlaceholderSection({ summary, planned = [] }: PlaceholderSectionProps) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <Badge tone="info">Foundation phase</Badge>
        <p className="text-sm font-medium text-zinc-900">
          This page is scaffolded but not yet functional.
        </p>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">{summary}</p>
      {planned.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600">
          {planned.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
