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
  isSyncing: boolean
  addToQueue: (item: OfflineQueueItem) => void
  removeFromQueue: (id: string) => void
  markSyncing: (isSyncing: boolean) => void
}

export const OFFLINE_STORE_PERSIST_KEY = "edutrack-offline-store"

const processors = new Map<string, OfflineQueueProcessor>()

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
      isSyncing: false,
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
      markSyncing: (isSyncing) => {
        setState({ isSyncing })
      },
    }),
    {
      name: OFFLINE_STORE_PERSIST_KEY,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ queue: state.queue, isSyncing: false }),
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

export async function syncOfflineQueue(): Promise<number> {
  const { isSyncing, queue, markSyncing } = useOfflineStore.getState()

  if (isSyncing || queue.length === 0) {
    return 0
  }

  markSyncing(true)
  let syncedCount = 0

  try {
    const sortedQueue = [...useOfflineStore.getState().queue].sort(
      (a, b) => a.timestamp - b.timestamp
    )

    for (const item of sortedQueue) {
      const processor = processors.get(item.queueKey)

      if (!processor) {
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
    useOfflineStore.getState().markSyncing(false)
  }

  return syncedCount
}
