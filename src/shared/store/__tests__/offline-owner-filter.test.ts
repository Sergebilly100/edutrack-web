import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const idbMemory = new Map<string, string>()

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbMemory.get(key) ?? null),
  set: vi.fn(async (key: string, value: string) => {
    idbMemory.set(key, value)
  }),
  del: vi.fn(async (key: string) => {
    idbMemory.delete(key)
  }),
}))

import {
  registerGlobalOfflineProcessor,
  setCurrentOwnerResolver,
  syncOfflineQueue,
  useOfflineStore,
  type OfflineQueueItem,
} from "@/shared/store/offline.store"

const QUEUE_KEY = "attendance-checkin"

function seedItem(id: string, ownerId: string | undefined): OfflineQueueItem {
  return { id, queueKey: QUEUE_KEY, variables: { id }, timestamp: Date.now(), ownerId }
}

describe("offline queue - filtrage par ownerId", () => {
  beforeEach(() => {
    idbMemory.clear()
    useOfflineStore.setState({ queue: [], _hasHydrated: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restaure un resolver neutre pour ne pas polluer les autres suites.
    setCurrentOwnerResolver(() => undefined)
  })

  it("ne rejoue pas l'item d'un autre prof (sûreté appareil partagé)", async () => {
    const mutationFn = vi.fn(async () => ({ ok: true }))
    registerGlobalOfflineProcessor(QUEUE_KEY, { mutationFn, maxRetries: 1 })

    // Item créé par le prof A, mais c'est le prof B qui est connecté.
    useOfflineStore.setState({ queue: [seedItem("a-1", "prof-A")], _hasHydrated: true })
    setCurrentOwnerResolver(() => "prof-B")

    const synced = await syncOfflineQueue()

    expect(mutationFn).not.toHaveBeenCalled()
    expect(synced).toBe(0)
    // L'item reste en file : il repartira quand le prof A se reconnectera.
    expect(useOfflineStore.getState().queue).toHaveLength(1)
  })

  it("rejoue l'item quand l'owner courant correspond", async () => {
    const mutationFn = vi.fn(async () => ({ ok: true }))
    registerGlobalOfflineProcessor(QUEUE_KEY, { mutationFn, maxRetries: 1 })

    useOfflineStore.setState({ queue: [seedItem("a-2", "prof-A")], _hasHydrated: true })
    setCurrentOwnerResolver(() => "prof-A")

    const synced = await syncOfflineQueue()

    expect(mutationFn).toHaveBeenCalledTimes(1)
    expect(synced).toBe(1)
    expect(useOfflineStore.getState().queue).toHaveLength(0)
  })

  it("rejoue les items legacy sans ownerId (rétrocompat)", async () => {
    const mutationFn = vi.fn(async () => ({ ok: true }))
    registerGlobalOfflineProcessor(QUEUE_KEY, { mutationFn, maxRetries: 1 })

    useOfflineStore.setState({ queue: [seedItem("legacy", undefined)], _hasHydrated: true })
    setCurrentOwnerResolver(() => "prof-B")

    const synced = await syncOfflineQueue()

    expect(mutationFn).toHaveBeenCalledTimes(1)
    expect(synced).toBe(1)
  })
})
