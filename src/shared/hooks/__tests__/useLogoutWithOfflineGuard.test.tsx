import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("idb-keyval", () => ({
  get: vi.fn(async () => null),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
}))

import { useLogoutWithOfflineGuard } from "@/shared/hooks/useLogoutWithOfflineGuard"
import { useOfflineStore, type OfflineQueueItem } from "@/shared/store/offline.store"

function seed(count: number): OfflineQueueItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    queueKey: "attendance-checkin",
    variables: {},
    timestamp: Date.now() + i,
  }))
}

describe("useLogoutWithOfflineGuard", () => {
  beforeEach(() => {
    useOfflineStore.setState({ queue: [], _hasHydrated: true })
  })

  it("file vide → logout direct, sans dialog, file purgée (keepOfflineQueue=false)", () => {
    const performLogout = vi.fn()
    const { result } = renderHook(() => useLogoutWithOfflineGuard(performLogout))

    act(() => result.current.requestLogout())

    expect(result.current.confirmOpen).toBe(false)
    expect(performLogout).toHaveBeenCalledWith({ keepOfflineQueue: false })
  })

  it("file non vide → ouvre le dialog au lieu de déconnecter immédiatement", () => {
    useOfflineStore.setState({ queue: seed(3), _hasHydrated: true })
    const performLogout = vi.fn()
    const { result } = renderHook(() => useLogoutWithOfflineGuard(performLogout))

    act(() => result.current.requestLogout())

    expect(result.current.confirmOpen).toBe(true)
    expect(result.current.pendingCount).toBe(3)
    expect(performLogout).not.toHaveBeenCalled()
  })

  it("confirmation → déconnecte en CONSERVANT la file (keepOfflineQueue=true)", () => {
    useOfflineStore.setState({ queue: seed(2), _hasHydrated: true })
    const performLogout = vi.fn()
    const { result } = renderHook(() => useLogoutWithOfflineGuard(performLogout))

    act(() => result.current.requestLogout())
    act(() => result.current.confirmLogout())

    expect(result.current.confirmOpen).toBe(false)
    expect(performLogout).toHaveBeenCalledWith({ keepOfflineQueue: true })
  })
})
