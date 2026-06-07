import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/shared/api/client", () => {
  return {
    apiClient: {
      get: getMock,
      post: postMock,
    },
  }
})

import { getSalariesStats, bulkMarkSalariesPaid } from "@/modules/salaries/salaries.api"

describe("salaries.api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("normalizes KPI stats and keeps paid amount distinct from amount to pay", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        totalToPay: "250000",
        totalPaid: "75000",
        totalPayroll: "325000",
        economy: {
          label: "Du 1er au 11 mai",
          plannedHours: "12.5",
          completedHours: null,
          savedAmount: "15000",
        },
        teacherAttendance: {
          globalRate: "80",
          partTime: { rate: "75", present: "3", expected: "4" },
          fullTime: null,
        },
      },
    })

    const stats = await getSalariesStats("2026-05")

    expect(getMock).toHaveBeenCalledWith("/salaries/summary", { params: { month: "2026-05" } })
    expect(stats.totalToPay).toBe(250000)
    expect(stats.totalPaid).toBe(75000)
    expect(stats.totalPayroll).toBe(325000)
    expect(stats.economy.completedHours).toBe(0)
    expect(stats.teacherAttendance.partTime.expected).toBe(4)
    expect(stats.teacherAttendance.fullTime.expected).toBe(0)
  })
})

describe("bulkMarkSalariesPaid", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retourne paid/skipped/results depuis la réponse API", async () => {
    postMock.mockResolvedValueOnce({
      data: {
        paid: 2,
        skipped: 1,
        results: [
          { recordId: "uuid-1", status: "ok" },
          { recordId: "uuid-2", status: "ok" },
          { recordId: "uuid-3", status: "skipped", reason: "already_paid" },
        ],
      },
    })

    const result = await bulkMarkSalariesPaid({
      items: [
        { recordId: "uuid-1", hoursToPay: 4 },
        { recordId: "uuid-2", hoursToPay: 2 },
        { recordId: "uuid-3", hoursToPay: 1 },
      ],
      notes: "Paiement groupé",
    })

    expect(postMock).toHaveBeenCalledWith("/billing/salary/bulk-mark-paid", {
      items: [
        { recordId: "uuid-1", hoursToPay: 4 },
        { recordId: "uuid-2", hoursToPay: 2 },
        { recordId: "uuid-3", hoursToPay: 1 },
      ],
      notes: "Paiement groupé",
    })
    expect(result.paid).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.results).toHaveLength(3)
  })

  it("retourne des valeurs par défaut si la réponse est mal formée", async () => {
    postMock.mockResolvedValueOnce({ data: null })

    const result = await bulkMarkSalariesPaid({
      items: [{ recordId: "uuid-1", hoursToPay: 2 }],
    })

    expect(result.paid).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.results).toEqual([])
  })

  it("n'envoie pas notes si elle est vide ou whitespace", async () => {
    postMock.mockResolvedValueOnce({ data: { paid: 1, skipped: 0, results: [] } })

    await bulkMarkSalariesPaid({
      items: [{ recordId: "uuid-1", hoursToPay: 2 }],
      notes: "   ",
    })

    expect(postMock).toHaveBeenCalledWith("/billing/salary/bulk-mark-paid", {
      items: [{ recordId: "uuid-1", hoursToPay: 2 }],
      notes: undefined,
    })
  })
})
