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
  addToQueue: (item: OfflineQueueItem) => void
  removeFromQueue: (id: string) => void
  clearQueue: () => void
}

export const OFFLINE_STORE_PERSIST_KEY = "edutrack-offline-store"

const processors = new Map<string, OfflineQueueProcessor>()

// Module-level Promise lock — prevents concurrent sync runs regardless of render cycles.
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
    }),
    {
      name: OFFLINE_STORE_PERSIST_KEY,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ queue: state.queue }),
    }
  )
)

export function registerOfflineProcessor<TData, TVariables>(
  queueKey: string,
  processor: OfflineQueueProcessor<TData, TVariables>
): () => void {
  processors.set(queueKey, processor as OfflineQueueProcessor)

  return () => {
    processors.delete(queueKey)
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
  processors.set(queueKey, processor as OfflineQueueProcessor)
}

export async function syncOfflineQueue(): Promise<number> {
  // If a sync is already in flight, wait for it and return its count rather than starting a new one.
  if (syncLock !== null) {
    return syncLock
  }

  const { queue } = useOfflineStore.getState()
  if (queue.length === 0) {
    return 0
  }

  syncLock = (async (): Promise<number> => {
    let syncedCount = 0

    try {
      const sortedQueue = [...useOfflineStore.getState().queue].sort(
        (a, b) => a.timestamp - b.timestamp
      )

      for (const item of sortedQueue) {
        const processor = processors.get(item.queueKey)

        if (!processor) {
          // L'item ne sera traité que si la page qui détient son processor est
          // remontée. Pour les actions critiques, utiliser registerGlobalOfflineProcessor.
          console.warn(
            `[offline-sync] No processor registered for queueKey="${item.queueKey}" — item ${item.id} skipped this round.`
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
