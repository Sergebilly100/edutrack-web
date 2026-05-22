import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // 30s stale window: two refetches within that window dedupe to a single request.
      // Live data (attendance/dashboard) overrides this per-query.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
    mutations: {
      retry: 0,
    },
  },
})
