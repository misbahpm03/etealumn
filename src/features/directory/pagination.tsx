/**
 * Server-rendered pagination links. Page numbers are validated server-side
 * (the service rejects deep/invalid pages), so these links cannot bypass
 * visibility — they only navigate the already-eligible result set.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const window = visiblePages(page, totalPages);
  const linkClass =
    "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none";

  return (
    <nav aria-label="Directory pages" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 ? (
        <a href={buildHref(page - 1)} rel="prev" className={linkClass}>
          Previous
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-400"
        >
          Previous
        </span>
      )}
      {window.map((item, index) =>
        item === "…" ? (
          <span key={`gap-${index}`} className="px-1 text-sm text-zinc-400">
            …
          </span>
        ) : item === page ? (
          <span
            key={item}
            aria-current="page"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            {item}
          </span>
        ) : (
          <a key={item} href={buildHref(item)} className={linkClass}>
            {item}
          </a>
        ),
      )}
      {page < totalPages ? (
        <a href={buildHref(page + 1)} rel="next" className={linkClass}>
          Next
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-400"
        >
          Next
        </span>
      )}
    </nav>
  );
}

function visiblePages(page: number, totalPages: number): Array<number | "…"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, 2, page - 1, page, page + 1, totalPages - 1, totalPages]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let previous = 0;
  for (const p of sorted) {
    if (p - previous > 1) out.push("…");
    out.push(p);
    previous = p;
  }
  return out;
}
