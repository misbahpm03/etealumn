"use client";

import "./globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Last-resort boundary when the root layout itself fails. Must render its
 * own <html>/<body> and stay dependency-light.
 */
export default function RootError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 font-sans text-zinc-900 antialiased">
        <main className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            The application failed to load. Please reload the page.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Reload page
          </button>
        </main>
      </body>
    </html>
  );
}
