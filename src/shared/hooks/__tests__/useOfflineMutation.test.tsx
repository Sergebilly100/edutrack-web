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

import { useAutoSync } from "@/shared/hooks/useAutoSync"
import { useOfflineMutation } from "@/shared/hooks/useOfflineMutation"
import * as offlineStoreModule from "@/shared/store/offline.store"
import { syncOfflineQueue, useOfflineStore } from "@/shared/store/offline.store"

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

describe("useOfflineMutation", () => {
  beforeEach(async () => {
    idbMemory.clear()
    useOfflineStore.setState({ queue: [], isSyncing: false })
    await useOfflineStore.persist.clearStorage()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.useRealTimers()
    setOnlineStatus(true)
  })

  it("executes mutation immediately when online", async () => {
    const mutationFn = vi.fn(async (payload: { attendanceId: string }) => ({
      ok: true,
      attendanceId: payload.attendanceId,
    }))

    const { result } = renderHook(
      () =>
        useOfflineMutation(mutationFn, {
          queueKey: "attendance-checkin",
        }),
      { wrapper: createQueryWrapper() }
    )

    await act(async () => {
      await result.current.mutateAsync({ attendanceId: "att-online" })
    })

    expect(mutationFn).toHaveBeenCalledTimes(1)
    expect(useOfflineStore.getState().queue).toHaveLength(0)
  })

  it("adds mutation to queue when offline", async () => {
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
      await result.current.mutateAsync({ attendanceId: "att-offline" })
    })

    expect(mutationFn).not.toHaveBeenCalled()
    expect(useOfflineStore.getState().queue).toHaveLength(1)
  })

  it("triggers sync when online event is dispatched via useAutoSync", async () => {
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
      await result.current.mutateAsync({ attendanceId: "att-sync-event" })
    })

    const syncSpy = vi.spyOn(offlineStoreModule, "syncOfflineQueue").mockResolvedValue(1)
    renderHook(() => useAutoSync())

    act(() => {
      setOnlineStatus(true)
      window.dispatchEvent(new Event("online"))
    })

    await waitFor(() => {
      expect(syncSpy).toHaveBeenCalledTimes(1)
    })
  })

  it("empties queue after successful sync", async () => {
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
      await result.current.mutateAsync({ attendanceId: "att-sync-success" })
    })

    expect(useOfflineStore.getState().queue).toHaveLength(1)

    await act(async () => {
      await syncOfflineQueue()
    })

    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledTimes(1)
      expect(useOfflineStore.getState().queue).toHaveLength(0)
    })
  })

  it("keeps item in queue after 3 failed retries without infinite loop", async () => {
    setOnlineStatus(false)
    vi.useFakeTimers()
    const mutationFn = vi.fn(async () => {
      throw new Error("sync failed")
    })

    const { result } = renderHook(
      () =>
        useOfflineMutation(mutationFn, {
          queueKey: "attendance-checkin",
          maxRetries: 3,
        }),
      { wrapper: createQueryWrapper() }
    )

    await act(async () => {
      await result.current.mutateAsync({ attendanceId: "att-sync-fail" })
    })

    const syncPromise = syncOfflineQueue()
    await vi.runAllTimersAsync()
    const syncedCount = await syncPromise

    expect(syncedCount).toBe(0)
    expect(mutationFn).toHaveBeenCalledTimes(3)
    expect(useOfflineStore.getState().queue).toHaveLength(1)
  })
})
