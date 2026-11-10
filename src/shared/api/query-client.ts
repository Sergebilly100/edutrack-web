import { MutationCache, QueryClient } from "@tanstack/react-query"
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

/**
 * Sources uniques des alertes directeur et des pastilles du menu : après toute mutation réussie
 * elles sont rechargées (le serveur recalcule les actions prioritaires à la lecture), sans rechargement de page.
 */
export const ACTION_SURFACE_QUERY_KEYS: ReadonlyArray<QueryKey> = [
  ["dashboard", "action-items"],
  ["validations", "pending", "count"],
  ["conduct", "decision-workspace"],
]

let actionSurfaceTimer: ReturnType<typeof setTimeout> | null = null
const refreshActionSurfaces = (): void => {
  if (actionSurfaceTimer !== null) return
  // Regroupe les mutations rapprochées (sélection groupée, mutations en chaîne) en un seul rechargement.
  actionSurfaceTimer = setTimeout(() => {
    actionSurfaceTimer = null
    for (const queryKey of ACTION_SURFACE_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey })
  }, 300)
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({ onSuccess: refreshActionSurfaces }),
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

let pendingCacheWrite: Promise<void> = Promise.resolve()

/** Write the current cache immediately after a mutation changes school population. */
export function persistQueryCacheNow(client: QueryClient = queryClient): Promise<void> {
  if (!isBrowser) return Promise.resolve()

  const queries = client
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

  // Serialize writes so a pending debounce cannot restore a pre-confirmation
  // snapshot after the explicit post-confirmation write.
  pendingCacheWrite = pendingCacheWrite.then(async () => {
    try {
      await set(QUERY_CACHE_STORAGE_KEY, { version: 1, savedAt: Date.now(), queries })
    } catch {
      // Quota dépassé : on garde le cache mémoire et on évite de casser l'app.
    }
  })
  return pendingCacheWrite
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
      void persistQueryCacheNow()
    }, QUERY_CACHE_SAVE_DEBOUNCE_MS)
  })
}

export const queryCacheRestorePromise = restoreQueryCache()
installQueryCachePersistence()
