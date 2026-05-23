import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useNetworkStatus } from "../useNetworkStatus"

describe("useNetworkStatus", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns initial online state when navigator.onLine is true", () => {
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.isOnline).toBe(true)
    expect(result.current.wasOffline).toBe(false)
  })

  it("flips to offline when the offline event fires", () => {
    const { result } = renderHook(() => useNetworkStatus())

    act(() => {
      window.dispatchEvent(new Event("offline"))
    })

    expect(result.current.isOnline).toBe(false)
    expect(result.current.wasOffline).toBe(true)
  })

  it("returns to online and clears wasOffline after the recovery window", async () => {
    const { result } = renderHook(() => useNetworkStatus())

    act(() => {
      window.dispatchEvent(new Event("offline"))
    })
    expect(result.current.isOnline).toBe(false)

    await act(async () => {
      window.dispatchEvent(new Event("online"))
      // allow the confirmConnectivity microtask to resolve (no-op in test mode)
      await Promise.resolve()
    })

    expect(result.current.isOnline).toBe(true)
    expect(result.current.wasOffline).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(5_001)
    })
    expect(result.current.wasOffline).toBe(false)
  })
})
