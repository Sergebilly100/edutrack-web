import { del, get, set } from "idb-keyval"
import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

export type OfflineQueueItem<TVariables = unknown> = {
  id: string
  queueKey: string
  variables: TVariables
  timestamp: number
  // Identité du user qui a créé l'item. Renseigné à la mise en file
  // (useOfflineMutation). La sync ne rejoue un item taggé que si l'owner
  // courant correspond - indispensable sur appareil partagé : sans ça, la
  // file d'un prof pourrait être rejouée sous la session d'un autre prof.
  // Optionnel pour rester rétrocompatible avec les items déjà persistés.
  ownerId?: string
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

// Résolveur de l'identité du user connecté, injecté au démarrage (main.tsx)
// pour ne PAS importer auth.store ici (auth.store importe déjà offline.store →
// éviter un cycle). Tant qu'aucun résolveur n'est installé, la sync rejoue tous
// les items (comportement historique, et items legacy sans ownerId).
let currentOwnerResolver: (() => string | undefined) | null = null

export function setCurrentOwnerResolver(resolver: () => string | undefined): void {
  currentOwnerResolver = resolver
}

// Un item est rejouable s'il n'a pas d'owner (legacy / rétrocompat) ou si son
// owner correspond au user actuellement connecté. Sans résolveur installé, on
// ne filtre pas.
function canReplayForCurrentOwner(item: OfflineQueueItem): boolean {
  if (item.ownerId === undefined || currentOwnerResolver === null) {
    return true
  }
  return item.ownerId === currentOwnerResolver()
}

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

const getHttpStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status

const isTerminalOfflineError = (error: unknown): boolean => {
  const status = getHttpStatus(error)
  return status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429
}

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
      // Erreur métier côté serveur (4xx sauf 429) → pas la peine de retenter
      if (isTerminalOfflineError(error)) {
        throw error
      }

      lastError = error
      const backoffDelay = 1000 * 2 ** attempt
      attempt += 1
      if (attempt >= maxRetries) break
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

      // On trie la queue par timestamp pour garantir l'ordre de traitement des items, même si des items plus anciens sont ajoutés pendant la sync (ex : pointage d'un cours précédent). 
      // Les nouveaux items ajoutés pendant la sync seront traités lors de la prochaine exécution de syncOfflineQueue, après leur propre délai de backoff.
      const sortedQueue = [...useOfflineStore.getState().queue].sort(
        (a, b) => a.timestamp - b.timestamp
      )

      for (const item of sortedQueue) {
        // Item créé par un AUTRE user que celui connecté : on le laisse en file
        // (ne pas le rejouer sous la mauvaise identité, ne pas le supprimer non
        // plus). Il repartira quand son propriétaire se reconnectera.
        if (!canReplayForCurrentOwner(item)) {
          continue
        }

        const processor = resolveProcessor(item.queueKey)

        if (!processor) {
          // L'item ne sera traité que si la page qui détient son processor est
          // remontée. Pour les actions critiques, utiliser registerGlobalOfflineProcessor.
          console.warn(
            `[offline-sync] No processor registered for queueKey="${item.queueKey}" - item ${item.id} skipped this round.`
          )
          continue
        }

        // On traite les items séquentiellement pour éviter les conflits (ex : deux mutations sur le même planning). 
        // En cas d'échec, on arrête la boucle pour éviter de rejouer les items suivants (potentiellement liés) dans le désordre. 
        // Le retry avec backoff est géré dans processWithRetry, qui rejoue l'item jusqu'à maxRetries avant d'abandonner et passer au suivant.
        try {
          const data = await processWithRetry( // en cas d'erreur, on réessaie jusqu'à maxRetries avec un backoff exponentiel
            processor.mutationFn,
            item.variables,
            processor.maxRetries
          )

          processor.onSync?.(data)
          useOfflineStore.getState().removeFromQueue(item.id)
          syncedCount += 1
        } catch (error) { // erreur après max retries - on log et on passe à l'item suivant pour éviter de bloquer toute la queue
          if (isTerminalOfflineError(error)) {
            console.warn(
              `[offline-sync] Dropping terminal queue item ${item.id} (${item.queueKey}) after HTTP ${getHttpStatus(error)}`
            )
            useOfflineStore.getState().removeFromQueue(item.id)
            continue
          }

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
