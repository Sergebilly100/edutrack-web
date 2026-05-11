import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/shared/api/client", () => {
  return {
    apiClient: {
      get: getMock,
    },
  }
})

import { getSalariesStats } from "@/modules/salaries/salaries.api"

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
