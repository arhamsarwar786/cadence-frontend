"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-[#f3ebd0] px-4 text-center text-[#242320]">
        <h1 className="font-serif text-2xl">Cadence could not load</h1>
        <p className="mt-2 max-w-md text-sm opacity-70">{error.message || "An unexpected error occurred."}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-full bg-[#f7dc7a] px-5 py-2 text-sm"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
