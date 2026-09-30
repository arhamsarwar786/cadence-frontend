import { QueryClient } from "@tanstack/react-query";

/**
 * Server records live in this cache, never a client store (ARCHITECTURE.md
 * §2.5 — no Redux/Zustand). Writes invalidate the resource's query keys so
 * TanStack Query refetches; nothing here guesses the next server state.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retrying a 4xx (403/404/400) can't change the answer and only delays the error UI.
        retry: (failureCount, error) => {
          const status = (error as { status?: number }).status;
          if (typeof status === "number" && status >= 400 && status < 500) return false;
          return failureCount < 1;
        },
      },
    },
  });
}
