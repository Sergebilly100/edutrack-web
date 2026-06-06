import { del, get, set } from "idb-keyval"
import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

export type OfflineQueueItem<TVariables = unknown> = {
  id: string
  queueKey: string
  variables: TVariables
  timestamp: number
}

type OfflineQueueProcessor<TData = unknown, TVariables = unknown> = {
  mutationFn: (variables: TVariables) => Promise<TData>
  onSync?: (data: TData) => void
  maxRetries: number
}

type OfflineState = {
  queue: OfflineQueueItem[]
  _hasHydrated: boolean
  addToQueue: (item: OfflineQueueItem) => void
  removeFromQueue: (id: string) => void
  clearQueue: () => void
  setHasHydrated: (value: boolean) => void
}

export const OFFLINE_STORE_PERSIST_KEY = "edutrack-offline-store"

// Deux registries pour éviter qu'un cleanup local (useEffect d'un hook
// useOfflineMutation) supprime le processor global équivalent (cas du
// "badge fantôme" : la sync trouvait le processor au moment où le composant
// était monté, puis le perdait juste après son unmount).
const localProcessors = new Map<string, OfflineQueueProcessor>()
const globalProcessors = new Map<string, OfflineQueueProcessor>()
const resolveProcessor = (queueKey: string): OfflineQueueProcessor | undefined =>
  localProcessors.get(queueKey) ?? globalProcessors.get(queueKey)

// Module-level Promise lock - prevents concurrent sync runs regardless of render cycles.
// Zustand state (isSyncing) is async and can be read stale by two callers before either
// has called markSyncing(true), causing double-sends. A plain Promise ref is synchronous.
let syncLock: Promise<number> | null = null

const idbStorage: StateStorage = {
  getItem: async (name) => {
    const value = await get(name)
    return value ? String(value) : null
  },
  setItem: async (name, value) => {
    await set(name, value)
  },
  removeItem: async (name) => {
    await del(name)
  },
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

async function processWithRetry<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  variables: TVariables,
  maxRetries: number
): Promise<TData> {
  let attempt = 0
  let lastError: unknown

  while (attempt < maxRetries) {
    try {
      return await mutationFn(variables)
    } catch (error) {
      lastError = error
      const backoffDelay = 1000 * 2 ** attempt
      attempt += 1

      if (attempt >= maxRetries) {
        break
      }

      await delay(backoffDelay)
    }
  }

  throw lastError
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (setState) => ({
      queue: [],
      _hasHydrated: false,
      addToQueue: (item) => {
        setState((state) => ({
          queue: [...state.queue, item].sort((a, b) => a.timestamp - b.timestamp),
        }))
      },
      removeFromQueue: (id) => {
        setState((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        }))
      },
      clearQueue: () => {
        setState({ queue: [] })
      },
      setHasHydrated: (value) => {
        setState({ _hasHydrated: value })
      },
    }),
    {
      name: OFFLINE_STORE_PERSIST_KEY,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ queue: state.queue }),
      // L'IndexedDB est async : sans cet écouteur, addToQueue/removeFromQueue
      // peuvent s'exécuter avant la rehydratation, et l'état restauré écrase
      // ensuite la mutation locale (badge fantôme après sync).
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

// Attend la fin de la rehydratation IndexedDB. Utilisé par syncOfflineQueue
// pour ne pas lire une queue partielle au démarrage de l'app.
export function waitForOfflineStoreHydration(): Promise<void> {
  if (useOfflineStore.getState()._hasHydrated) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    const unsub = useOfflineStore.subscribe((state) => {
      if (state._hasHydrated) {
        unsub()
        resolve()
      }
    })
  })
}

export function registerOfflineProcessor<TData, TVariables>(
  queueKey: string,
  processor: OfflineQueueProcessor<TData, TVariables>
): () => void {
  localProcessors.set(queueKey, processor as OfflineQueueProcessor)

  return () => {
    localProcessors.delete(queueKey)
  }
}

// Variante pour les mutations critiques (paiements, plannings) : enregistre
// le processor au niveau module, sans cleanup. Garantit que la queue se vide
// au retour réseau même si l'utilisateur a quitté la page qui a déclenché la
// mise en file d'attente.
export function registerGlobalOfflineProcessor<TData, TVariables>(
  queueKey: string,
  processor: OfflineQueueProcessor<TData, TVariables>
): void {
  globalProcessors.set(queueKey, processor as OfflineQueueProcessor)
}

export async function syncOfflineQueue(): Promise<number> {
  // Lock pose synchrone : indispensable pour que deux appels concurrents
  // partagent la même promesse (sinon ils passeraient tous deux la garde
  // avant l'affectation et rejoueraient deux fois la queue).
  if (syncLock !== null) {
    return syncLock
  }

  syncLock = (async (): Promise<number> => {
    let syncedCount = 0

    try {
      // Sans ce gate, un appel au boot (avant la rehydratation IndexedDB)
      // lirait queue=[] et partirait en no-op alors que des items sont
      // persistés et apparaîtraient juste après dans le store.
      await waitForOfflineStoreHydration()

      if (useOfflineStore.getState().queue.length === 0) {
        return 0
      }

      const sortedQueue = [...useOfflineStore.getState().queue].sort(
        (a, b) => a.timestamp - b.timestamp
      )

      for (const item of sortedQueue) {
        const processor = resolveProcessor(item.queueKey)

        if (!processor) {
          // L'item ne sera traité que si la page qui détient son processor est
          // remontée. Pour les actions critiques, utiliser registerGlobalOfflineProcessor.
          console.warn(
            `[offline-sync] No processor registered for queueKey="${item.queueKey}" - item ${item.id} skipped this round.`
          )
          continue
        }

        try {
          const data = await processWithRetry(
            processor.mutationFn,
            item.variables,
            processor.maxRetries
          )

          processor.onSync?.(data)
          useOfflineStore.getState().removeFromQueue(item.id)
          syncedCount += 1
        } catch (error) {
          console.error(
            `[offline-sync] Failed to sync queue item ${item.id} after ${processor.maxRetries} retries`,
            error
          )
        }
      }
    } finally {
      syncLock = null
    }

    return syncedCount
  })()

  return syncLock
}
