import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, putMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), putMock: vi.fn() }))
vi.mock("@/shared/api/client", () => ({ apiClient: { get: getMock, post: postMock, put: putMock } }))

import { fetchFinancialAlertLogs, getCashJournal, getParentPaymentOptions, getStudentAccountStatement, listPayments, listTuitionPlans, saveProviderSetting } from "../finance.api"

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

  it("normalise le journal filtré et les soldes successifs du compte élève", async () => {
    getMock.mockResolvedValueOnce({ data: { journal: {
      count: 1,
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
      totals: { cash: "25000", mobile_money: 0, bank_transfer: 0, grandTotal: "25000" },
      entries: [{
        id: "payment-1", amount: "25000", method: "cash", source: "bulk_import", status: "confirmed",
        paymentDate: "2026-08-19", createdAt: "2026-08-19T12:00:00Z", studentName: "Awa Koné",
        studentMatricule: "EL-1", classId: "class-1", className: "6ème A",
      }],
    } } })
    const journal = await getCashJournal({ schoolYearId: "year-1", from: "2026-08-01", to: "2026-08-31", method: "cash", page: 2, limit: 20 })
    expect(getMock).toHaveBeenCalledWith("/payments/cash-journal", { params: expect.objectContaining({ page: 2, limit: 20 }) })
    expect(journal.totals.grandTotal).toBe(25000)
    expect(journal.pagination).toEqual({ page: 2, limit: 20, total: 21, totalPages: 2 })
    expect(journal.entries[0]).toMatchObject({ studentName: "Awa Koné", paymentDate: "2026-08-19" })

    getMock.mockResolvedValueOnce({ data: { statement: {
      student: { id: "student-1", name: "Awa Koné", classId: "class-1", className: "6ème A" },
      schoolYearId: "year-1", currency: "FCFA", totalDue: "100000",
      movements: [{ id: "payment-1", amount: "25000", method: "cash", status: "confirmed", paymentDate: "2026-08-19", runningPaid: "25000", balanceAfter: "75000" }],
    } } })
    const statement = await getStudentAccountStatement("student-1", "year-1")
    expect(statement.movements[0]).toMatchObject({ runningPaid: 25000, balanceAfter: 75000 })
  })

  it("demande une page précise de l’historique des relances", async () => {
    getMock.mockResolvedValueOnce({ data: {
      logs: [{ id: "alert-1", student_name: "Awa Koné", rule_type: "late", channel: "sms", status: "sent", sent_at: "2026-08-19T12:00:00Z" }],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    } })

    await expect(fetchFinancialAlertLogs(2, 20)).resolves.toMatchObject({
      logs: [expect.objectContaining({ id: "alert-1" })],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    })
    expect(getMock).toHaveBeenCalledWith("/financial-alert-logs", { params: { page: 2, limit: 20 } })
  })
})
