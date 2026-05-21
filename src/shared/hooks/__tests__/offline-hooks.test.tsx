import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const idbMemory = new Map<string, string>()

vi.mock("idb-keyval", () => {
  return {
    get: vi.fn(async (key: string) => idbMemory.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      idbMemory.set(key, value)
    }),
    del: vi.fn(async (key: string) => {
      idbMemory.delete(key)
    }),
  }
})

import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import { OfflineMutationQueuedError, useOfflineMutation } from "@/shared/hooks/useOfflineMutation"
import {
  OFFLINE_STORE_PERSIST_KEY,
  syncOfflineQueue,
  useOfflineStore,
} from "@/shared/store/offline.store"

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function setOnlineStatus(isOnline: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: isOnline,
  })
}

describe("offline hooks", () => {
  beforeEach(async () => {
    idbMemory.clear()
    useOfflineStore.setState({ queue: [] })
    await useOfflineStore.persist.clearStorage()
    vi.clearAllMocks()
    vi.useRealTimers()
    setOnlineStatus(true)
  })

  it("queues mutation and persists it when offline", async () => {
    setOnlineStatus(false)
    const mutationFn = vi.fn(async () => ({ ok: true }))

    const { result } = renderHook(
      () =>
        useOfflineMutation(mutationFn, {
          queueKey: "attendance-checkin",
        }),
      { wrapper: createQueryWrapper() }
    )

    await act(async () => {
      await expect(
        result.current.mutateAsync({ attendanceId: "att-1" })
      ).rejects.toBeInstanceOf(OfflineMutationQueuedError)
    })

    expect(mutationFn).not.toHaveBeenCalled()
    expect(useOfflineStore.getState().queue).toHaveLength(1)

    await waitFor(() => {
      const persistedPayload = idbMemory.get(OFFLINE_STORE_PERSIST_KEY)
      expect(persistedPayload).toBeTruthy()
      expect(persistedPayload).toContain("attendance-checkin")
      expect(persistedPayload).toContain("att-1")
    })
  })

  it("syncs queued mutation when network comes back online", async () => {
    setOnlineStatus(false)
    const mutationFn = vi.fn(async () => ({ ok: true }))
    const onSync = vi.fn()

    const { result } = renderHook(
      () =>
        useOfflineMutation(mutationFn, {
          queueKey: "attendance-checkin",
          onSync,
        }),
      { wrapper: createQueryWrapper() }
    )

    await act(async () => {
      await expect(
        result.current.mutateAsync({ attendanceId: "att-2" })
      ).rejects.toBeInstanceOf(OfflineMutationQueuedError)
    })

    expect(useOfflineStore.getState().queue).toHaveLength(1)

    act(() => {
      setOnlineStatus(true)
      window.dispatchEvent(new Event("online"))
    })

    await act(async () => {
      await syncOfflineQueue()
    })

    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledTimes(1)
      expect(onSync).toHaveBeenCalledTimes(1)
      expect(useOfflineStore.getState().queue).toHaveLength(0)
    })
  })

  it("keeps wasOffline true for 5 seconds after coming back online", async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useNetworkStatus())

    act(() => {
      setOnlineStatus(false)
      window.dispatchEvent(new Event("offline"))
    })

    expect(result.current.isOnline).toBe(false)
    expect(result.current.wasOffline).toBe(true)

    act(() => {
      setOnlineStatus(true)
      window.dispatchEvent(new Event("online"))
    })

    expect(result.current.isOnline).toBe(true)
    expect(result.current.wasOffline).toBe(true)

    act(() => {
      vi.advanceTimersByTime(5001)
    })

    expect(result.current.wasOffline).toBe(false)
    vi.useRealTimers()
  })

  it("continues syncing remaining items if one fails after maxRetries", async () => {
    setOnlineStatus(false)
    const failingFn = vi.fn(async () => {
      throw new Error("server error")
    })
    const successFn = vi.fn(async () => ({ ok: true }))

    const { result: r1 } = renderHook(
      () => useOfflineMutation(failingFn, { queueKey: "failing-op", maxRetries: 1 }),
      { wrapper: createQueryWrapper() }
    )
    const { result: r2 } = renderHook(
      () => useOfflineMutation(successFn, { queueKey: "success-op" }),
      { wrapper: createQueryWrapper() }
    )

    await act(async () => {
      await expect(r1.current.mutateAsync({ id: "x" })).rejects.toBeInstanceOf(OfflineMutationQueuedError)
      await expect(r2.current.mutateAsync({ id: "y" })).rejects.toBeInstanceOf(OfflineMutationQueuedError)
    })

    expect(useOfflineStore.getState().queue).toHaveLength(2)

    await act(async () => {
      await syncOfflineQueue()
    })

    await waitFor(() => {
      expect(successFn).toHaveBeenCalledTimes(1)
      expect(useOfflineStore.getState().queue).toHaveLength(1)
      expect(useOfflineStore.getState().queue[0].queueKey).toBe("failing-op")
    })
  })

  it("does not sync twice when syncOfflineQueue is called concurrently", async () => {
    setOnlineStatus(false)
    const mutationFn = vi.fn(async () => ({ ok: true }))

    const { result } = renderHook(
      () => useOfflineMutation(mutationFn, { queueKey: "attendance-checkin" }),
      { wrapper: createQueryWrapper() }
    )

    await act(async () => {
      await expect(
        result.current.mutateAsync({ attendanceId: "att-3" })
      ).rejects.toBeInstanceOf(OfflineMutationQueuedError)
    })

    await act(async () => {
      await Promise.all([syncOfflineQueue(), syncOfflineQueue()])
    })

    expect(mutationFn).toHaveBeenCalledTimes(1)
  })
})
