import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, putMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), putMock: vi.fn() }))
vi.mock("@/shared/api/client", () => ({ apiClient: { get: getMock, post: postMock, put: putMock } }))

import { getParentPaymentOptions, listPayments, listTuitionPlans, saveProviderSetting } from "../finance.api"

describe("finance.api", () => {
  beforeEach(() => vi.clearAllMocks())

  it("normalise l’historique et transmet l’année scolaire", async () => {
    getMock.mockResolvedValueOnce({ data: { payments: [{
      id: "payment-1", studentId: "student-1", schoolYearId: "year-1", amount: "25000",
      method: "cash", source: "cashier_manual", status: "confirmed", receiptNumber: "REC-1",
      createdAt: "2026-08-19T10:00:00.000Z",
    }] } })

    const result = await listPayments("student-1", "year-1")

    expect(getMock).toHaveBeenCalledWith("/students/student-1/payments", { params: { school_year_id: "year-1" } })
    expect(result[0]).toMatchObject({ amount: 25000, receiptNumber: "REC-1" })
  })

  it("normalise les seuils cumulés du plan de frais", async () => {
    getMock.mockResolvedValueOnce({ data: { tuitionPlans: [{
      id: "plan-1", level_id: "level-1", level_name: "6ème", school_year_id: "year-1", school_year_label: "2026-2027", total_amount: "150000", currency: "FCFA",
      schedule_steps: [{ id: "step-1", dueDate: "2026-10-01", cumulativeAmountExpected: "50000" }],
    }] } })

    const result = await listTuitionPlans("year-1")

    expect(getMock).toHaveBeenCalledWith("/tuition-plans", { params: { school_year_id: "year-1" } })
    expect(result[0]).toMatchObject({ levelId: "level-1", levelName: "6ème", totalAmount: 150000 })
    expect(result[0]?.scheduleSteps[0]?.cumulativeAmountExpected).toBe(50000)
  })

  it("force le canal direct inactif dans la configuration et côté parent", async () => {
    putMock.mockResolvedValueOnce({ data: {} })
    await saveProviderSetting({ provider: "orange_money", merchantNumber: "0700000000", apiCredentials: {} })
    expect(putMock).toHaveBeenCalledWith("/payment-provider-settings", expect.objectContaining({ isActive: false }))

    getMock.mockResolvedValueOnce({ data: { inAppPaymentActive: true, manualPaymentChannels: [{ provider: "orange_money", merchant_number: "0700000000" }] } })
    await expect(getParentPaymentOptions()).resolves.toMatchObject({
      inAppPaymentActive: false,
      manualPaymentChannels: [{ provider: "orange_money", merchantNumber: "0700000000" }],
    })
  })
})
