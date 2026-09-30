import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

const persistence = vi.hoisted(() => ({ set: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(undefined), del: vi.fn().mockResolvedValue(undefined) }))
vi.mock("idb-keyval", () => persistence)

import { refreshConfirmedPopulation } from "../confirmed-population-cache"

const populationKeys = [
  ["students", "list", "year-1"],
  ["students", "list", "year-2"],
  ["academic", "classes", "year-1"],
  ["dashboard", "pilotage", "year-1"],
  ["report-cards-readiness", "period-1"],
  ["class-completion", "class-1", "period-1"],
  ["evaluations-scope", "class-1", "period-1"],
  ["conduct-overview", "student-1", "period-1"],
  ["class-decisions", "list", "year-1"],
  ["student-roll-call", "slot-1"],
  ["attendance", "today"],
  ["risks", "students", "year-1"],
  ["finance", "recovery", "year-1"],
  ["subscriptions", "students", "class-1"],
  ["parent", "students"],
] as const

describe("refreshConfirmedPopulation", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("écarte les anciens replis offline et les données persistées des deux années", async () => {
    const cacheDelete = vi.fn().mockResolvedValue(true)
    vi.stubGlobal("caches", { delete: cacheDelete })
    const client = new QueryClient()
    for (const key of populationKeys) client.setQueryData([...key], { total: 0 })
    client.setQueryData(["settings", "school-config"], { schoolName: "École" })
    client.setQueryData(["academic", "school-years"], { years: ["year-1"] })
    client.setQueryData(["finance", "tuition-plans"], { plans: [] })
    const invalidate = vi.spyOn(client, "invalidateQueries")

    await refreshConfirmedPopulation(client)

    expect(cacheDelete).toHaveBeenCalledWith("classes-cache")
    expect(cacheDelete).toHaveBeenCalledWith("students-cache")
    expect(cacheDelete).toHaveBeenCalledWith("dashboard-cache")
    expect(cacheDelete.mock.invocationCallOrder.at(-1)).toBeLessThan(invalidate.mock.invocationCallOrder[0])
    for (const key of populationKeys) expect(client.getQueryData([...key])).toBeUndefined()
    expect(client.getQueryData(["settings", "school-config"])).toEqual({ schoolName: "École" })
    expect(client.getQueryData(["academic", "school-years"])).toEqual({ years: ["year-1"] })
    expect(client.getQueryData(["finance", "tuition-plans"])).toEqual({ plans: [] })
    const saved = persistence.set.mock.lastCall?.[1] as { queries: Array<{ queryKey: string[] }> }
    expect(saved.queries.map((item) => item.queryKey)).toContainEqual(["settings", "school-config"])
    expect(saved.queries.map((item) => item.queryKey)).not.toContainEqual(["students", "list", "year-1"])
    expect(saved.queries.map((item) => item.queryKey)).not.toContainEqual(["students", "list", "year-2"])
  })

  it("recharge les requêtes actives depuis le serveur quand CacheStorage est indisponible", async () => {
    vi.stubGlobal("caches", undefined)
    const client = new QueryClient()
    const fetchClasses = vi.fn().mockResolvedValueOnce({ total: 0 }).mockResolvedValueOnce({ total: 1 })
    const observer = new QueryObserver(client, { queryKey: ["academic", "classes", "year-1"], queryFn: fetchClasses })
    const unsubscribe = observer.subscribe(() => undefined)
    await observer.refetch()

    await refreshConfirmedPopulation(client)

    expect(fetchClasses).toHaveBeenCalledTimes(2)
    expect(client.getQueryData(["academic", "classes", "year-1"])).toEqual({ total: 1 })
    unsubscribe()
  })
})
