import { QueryClient } from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"

const QUERY_CACHE_STORAGE_KEY = "edutrack-query-cache-v1"
const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const QUERY_CACHE_SAVE_DEBOUNCE_MS = 750
const PERSISTED_QUERY_PREFIXES = new Set([
  "attendance",
  "attendance-policy",
  "dashboard",
  "rooms",
  "salaries",
  "schedule",
  "school",
  "students",
  "teacher",
  "teacher-attendance",
  "teacher-compliance",
  "teacher-schedule",
  "teachers",
  "validations",
])

type PersistedQuery = {
  queryKey: QueryKey
  data: unknown
  updatedAt: number
}

type PersistedQueryCache = {
  version: 1
  savedAt: number
  queries: PersistedQuery[]
}

const isBrowser = typeof window !== "undefined"

const shouldPersistQuery = (queryKey: QueryKey): boolean => {
  const [prefix] = queryKey
  return typeof prefix === "string" && PERSISTED_QUERY_PREFIXES.has(prefix)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
      // 30s stale window: two refetches within that window dedupe to a single request.
      // Live data (attendance/dashboard) overrides this per-query.
      staleTime: 30_000,
      gcTime: 24 * 60 * 60_000,
    },
    mutations: {
      retry: 0,
    },
  },
})

function restoreQueryCache(): void {
  if (!isBrowser) return

  try {
    const raw = window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY)
    if (!raw) return

    const cache = JSON.parse(raw) as PersistedQueryCache
    if (cache.version !== 1 || Date.now() - cache.savedAt > QUERY_CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY)
      return
    }

    for (const query of cache.queries) {
      if (!shouldPersistQuery(query.queryKey)) continue
      queryClient.setQueryData(query.queryKey, query.data, { updatedAt: query.updatedAt })
    }
  } catch {
    window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY)
  }
}

function persistQueryCache(): void {
  if (!isBrowser) return

  const queries = queryClient
    .getQueryCache()
    .findAll()
    .filter((query) => query.state.status === "success")
    .filter((query) => query.state.data !== undefined)
    .filter((query) => shouldPersistQuery(query.queryKey))
    .map((query) => ({
      queryKey: query.queryKey,
      data: query.state.data,
      updatedAt: query.state.dataUpdatedAt,
    }))

  try {
    window.localStorage.setItem(
      QUERY_CACHE_STORAGE_KEY,
      JSON.stringify({ version: 1, savedAt: Date.now(), queries })
    )
  } catch {
    // Quota dépassé : on garde le cache mémoire et on évite de casser l'app.
  }
}

function installQueryCachePersistence(): void {
  if (!isBrowser) return

  let saveTimer: number | null = null
  queryClient.getQueryCache().subscribe(() => {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer)
    }
    saveTimer = window.setTimeout(() => {
      saveTimer = null
      persistQueryCache()
    }, QUERY_CACHE_SAVE_DEBOUNCE_MS)
  })
}

restoreQueryCache()
installQueryCachePersistence()
