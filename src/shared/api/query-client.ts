import { QueryClient } from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"
import { del, get, set } from "idb-keyval"

const QUERY_CACHE_STORAGE_KEY = "edutrack-query-cache-v1"
const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const QUERY_CACHE_SAVE_DEBOUNCE_MS = 750
const NON_PERSISTED_QUERY_PREFIXES = new Set([
  "auth",
  "admin",
  "parent-auth",
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
  return typeof prefix === "string" && !NON_PERSISTED_QUERY_PREFIXES.has(prefix)
}

const removePersistedQueryCache = async (): Promise<void> => {
  try {
    await del(QUERY_CACHE_STORAGE_KEY)
  } catch {
    // Un stockage IndexedDB indisponible ne doit pas empêcher le rendu de l'app.
  }
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
      // offlineFirst : la query part toujours, même si onlineManager dit
      // offline. Si elle échoue, Workbox/cache TanStack persiste la réponse
      // précédente - donc l'UI continue à montrer les dernières données
      // chargées. Sans ça, en offline les queries restent en `pending` ad
      // vitam et affichent un état vide même si le cache contient les data.
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: 0,
      // Les mutations offline passent par useOfflineMutation qui queue
      // explicitement. networkMode: "offlineFirst" ici évite que TanStack
      // mette en pause les mutations passantes (validations, etc.) quand
      // onlineManager croit à tort qu'on est offline.
      networkMode: "offlineFirst",
    },
  },
})

let cacheRestoreCompleted = false

export const isQueryCacheRestored = (): boolean => cacheRestoreCompleted

export async function restoreQueryCache(): Promise<void> {
  if (!isBrowser) {
    cacheRestoreCompleted = true
    return
  }

  try {
    const cache = await get<PersistedQueryCache>(QUERY_CACHE_STORAGE_KEY)
    if (!cache) return

    if (cache.version !== 1 || Date.now() - cache.savedAt > QUERY_CACHE_MAX_AGE_MS) {
      await removePersistedQueryCache()
      return
    }

    for (const query of cache.queries) {
      if (!shouldPersistQuery(query.queryKey)) continue
      queryClient.setQueryData(query.queryKey, query.data, { updatedAt: query.updatedAt })
    }
  } catch {
    await removePersistedQueryCache()
  } finally {
    // Le flag autorise App.tsx à débloquer le rendu : sans cela, on
    // affiche des pages vides en offline parce que les useQuery partent
    // avant que setQueryData ait écrit le cache hydraté.
    cacheRestoreCompleted = true
  }
}

async function persistQueryCache(): Promise<void> {
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
    await set(QUERY_CACHE_STORAGE_KEY, { version: 1, savedAt: Date.now(), queries })
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
      void persistQueryCache()
    }, QUERY_CACHE_SAVE_DEBOUNCE_MS)
  })
}

export const queryCacheRestorePromise = restoreQueryCache()
installQueryCachePersistence()
