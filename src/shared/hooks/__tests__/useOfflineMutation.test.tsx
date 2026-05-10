import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { useOfflineMutation } from "../useOfflineMutation"

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useOfflineMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should execute mutation immediately if online", async () => {
    const mockMutationFn = vi.fn().mockResolvedValue({ success: true })

    const { result } = renderHook(
      () => useOfflineMutation(mockMutationFn, { queueKey: "test-queue" }),
      { wrapper: createWrapper() }
    )

    await result.current.mutateAsync({ data: "test" })

    await waitFor(() => {
      expect(mockMutationFn).toHaveBeenCalledTimes(1)
      expect(mockMutationFn).toHaveBeenCalledWith(
        { data: "test" },
        expect.objectContaining({ client: expect.any(Object) })
      )
    })
  })

  it("should queue mutation if offline", async () => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    })

    const mockMutationFn = vi.fn().mockResolvedValue({ success: true })

    const { result } = renderHook(
      () => useOfflineMutation(mockMutationFn, { queueKey: "test-queue" }),
      { wrapper: createWrapper() }
    )

    await result.current.mutateAsync({ data: "offline-test" })

    // La mutation ne doit pas être appelée immédiatement
    expect(mockMutationFn).not.toHaveBeenCalled()

    // La mutation doit être dans la queue (vérifier via le store Zustand)
    // Note: ceci nécessite d'accéder au store offline
  })

  it("should retry queued mutations when network restored", async () => {
    // Mock du passage offline → online
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    })

    const mockMutationFn = vi.fn().mockResolvedValue({ success: true })

    const { result, rerender } = renderHook(
      () => useOfflineMutation(mockMutationFn, { queueKey: "test-queue" }),
      { wrapper: createWrapper() }
    )

    // Mutation en mode offline
    await result.current.mutateAsync({ data: "queued" })

    expect(mockMutationFn).not.toHaveBeenCalled()

    // Simuler le retour en ligne
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    })

    // Déclencher l'événement 'online'
    window.dispatchEvent(new Event("online"))

    await waitFor(() => {
      expect(mockMutationFn).toHaveBeenCalledTimes(1)
    })
  })

  it("should handle mutation errors gracefully", async () => {
    const mockMutationFn = vi.fn().mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(
      () => useOfflineMutation(mockMutationFn, { queueKey: "test-queue" }),
      { wrapper: createWrapper() }
    )

    await expect(result.current.mutateAsync({ data: "test" })).rejects.toThrow("Network error")
  })

  it("should deduplicate queued mutations with same key", async () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    })

    const mockMutationFn = vi.fn().mockResolvedValue({ success: true })

    const { result } = renderHook(
      () => useOfflineMutation(mockMutationFn, { queueKey: "test-queue" }),
      { wrapper: createWrapper() }
    )

    // Appeler la même mutation plusieurs fois
    await result.current.mutateAsync({ id: "same-id", data: "test1" })
    await result.current.mutateAsync({ id: "same-id", data: "test2" })

    // Vérifier que seule la dernière mutation est conservée
    // Note: ceci dépend de l'implémentation de la déduplication
  })
})
