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
        retry: 1,
      },
    },
  });
}
