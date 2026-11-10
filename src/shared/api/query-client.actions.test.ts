import { QueryObserver } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { queryClient } from "./query-client"

describe("queryClient – rechargement des alertes après mutation", () => {
  afterEach(() => { queryClient.clear(); vi.useRealTimers() })

  it("une mutation réussie recharge les actions prioritaires et les pastilles, en un seul passage", async () => {
    vi.useFakeTimers()
    const actionFetch = vi.fn().mockResolvedValue([])
    const badgeFetch = vi.fn().mockResolvedValue({ total: 2 })
    const unrelatedFetch = vi.fn().mockResolvedValue("x")
    const observers = [
      new QueryObserver(queryClient, { queryKey: ["dashboard", "action-items"], queryFn: actionFetch, staleTime: Infinity }),
      new QueryObserver(queryClient, { queryKey: ["validations", "pending", "count", "sidebar"], queryFn: badgeFetch, staleTime: Infinity }),
      new QueryObserver(queryClient, { queryKey: ["students", "list"], queryFn: unrelatedFetch, staleTime: Infinity }),
    ]
    const unsubscribe = observers.map((observer) => observer.subscribe(() => undefined))
    await vi.advanceTimersByTimeAsync(0)
    expect([actionFetch.mock.calls.length, badgeFetch.mock.calls.length]).toEqual([1, 1])

    await queryClient.getMutationCache().build(queryClient, { mutationFn: async () => "ok" }).execute(undefined)
    await queryClient.getMutationCache().build(queryClient, { mutationFn: async () => "ok" }).execute(undefined)
    await vi.advanceTimersByTimeAsync(400)

    expect(actionFetch).toHaveBeenCalledTimes(2)
    expect(badgeFetch).toHaveBeenCalledTimes(2)
    expect(unrelatedFetch).toHaveBeenCalledTimes(1)
    unsubscribe.forEach((stop) => stop())
  })
})
