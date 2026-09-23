import { type ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AxiosError, AxiosHeaders } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/shared/api/client"
import { OfflineMutationQueuedError, useOfflineMutation } from "../useOfflineMutation"
import { useOfflineStore } from "@/shared/store/offline.store"

vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function wrappedError(status?: number) {
  const config = { headers: new AxiosHeaders() }
  const response = status ? { status, statusText: "Error", data: {}, config, headers: {} } : undefined
  return new ApiError("Échec du pointage", { status, cause: new AxiosError("Network Error", undefined, config, undefined, response) })
}

describe("F05 — erreurs du client API et file hors connexion", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
    useOfflineStore.setState({ queue: [], _hasHydrated: true })
  })

  it("conserve le pointage quand Axios encapsulé échoue sans réponse HTTP", async () => {
    const send = vi.fn().mockRejectedValue(wrappedError())
    const { result } = renderHook(() => useOfflineMutation(send, { queueKey: "qa-network" }), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync({ schedule_id: "slot-qa" })).rejects.toBeInstanceOf(OfflineMutationQueuedError)
    })
    expect(useOfflineStore.getState().queue).toEqual([expect.objectContaining({ queueKey: "qa-network", variables: { schedule_id: "slot-qa" } })])
  })

  it.each([400, 403, 409, 500])("ne rejoue pas une réponse HTTP %s comme une coupure réseau", async (status) => {
    const error = wrappedError(status)
    const send = vi.fn().mockRejectedValue(error)
    const { result } = renderHook(() => useOfflineMutation(send, { queueKey: "qa-http" }), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync({ id: "qa" })).rejects.toBe(error) })
    expect(useOfflineStore.getState().queue).toEqual([])
  })
})
