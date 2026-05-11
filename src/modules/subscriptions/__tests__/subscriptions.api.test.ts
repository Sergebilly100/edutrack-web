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

import { getSubscriptionsRevenueStats } from "@/modules/subscriptions/subscriptions.api"

describe("subscriptions.api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requests revenue stats for the selected month and normalizes missing fields", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        subscriptions_active_count: "8",
        subscriptions_new_this_month: "2",
        total_collected_fcfa: "120000",
        commission_due_fcfa: "18000",
        commission_paid_fcfa: "5000",
        commission_remaining_fcfa: "13000",
        commission_pct: "15",
        isReverseOverdue: true,
        overdueMonths: [{ month: "2026-04", amount: "50000", dueDate: "2026-04-15", daysPastDue: "26" }],
      },
    })

    const stats = await getSubscriptionsRevenueStats("2026-05")

    expect(getMock).toHaveBeenCalledWith("/subscriptions/revenue/summary", { params: { month: "2026-05" } })
    expect(stats.collectedAmount).toBe(120000)
    expect(stats.activeSubscribers).toBe(8)
    expect(stats.newSubscribers).toBe(2)
    expect(stats.schoolGain).toBe(102000)
    expect(stats.edutrackCommission).toBe(18000)
    expect(stats.commissionPaid).toBe(5000)
    expect(stats.remainingToReverse).toBe(13000)
    expect(stats.nextReverseDate).toBeNull()
    expect(stats.overdueMonths[0]).toMatchObject({
      month: "2026-04",
      amount: 50000,
      daysPastDue: 26,
    })
  })
})
