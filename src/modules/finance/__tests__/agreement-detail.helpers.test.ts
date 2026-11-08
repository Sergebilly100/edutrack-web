import { describe, expect, it } from "vitest"

import { buildInstallmentRows, buildOverrideBreakdown, getAgreementTitle, getInstallmentStatus, installmentStatusLabel, scheduleCollectedPercent } from "../agreement-detail.helpers"
import type { AgreementRegisterEntry } from "../finance.api"

const entry = (over: Partial<AgreementRegisterEntry>): AgreementRegisterEntry => ({
  id: "a", kind: "override", status: "active", student_id: "s", school_year_id: "y", student_name: "N", matricule: null, class_name: "C", level_name: "L",
  discount_amount: 50000, override_total_amount: 0, active_discount_amount: 0, plan_total_amount: 300000, total_paid: 150000, remaining_due: 100000,
  financial_status: "late", created_at: "2026-09-11", created_by_name: null, withdrawn_at: null, step_count: 0, schedule_total_amount: 0, next_due_date: null, ...over,
})

describe("getInstallmentStatus", () => {
  const base = { dueDate: "2026-10-16", cumulativeExpected: 270000, totalPaid: 180000 }
  it("payée si le cumul encaissé couvre le cumul attendu", () => {
    expect(getInstallmentStatus({ ...base, totalPaid: 270000, today: "2026-11-05" })).toEqual({ kind: "paid" })
  })
  it("en retard avec le nombre de jours depuis la date prévue", () => {
    expect(getInstallmentStatus({ ...base, today: "2026-11-05" })).toEqual({ kind: "overdue", daysLate: 20 })
    expect(installmentStatusLabel({ kind: "overdue", daysLate: 20 })).toBe("En retard · 20 jours")
    expect(installmentStatusLabel({ kind: "overdue", daysLate: 1 })).toBe("En retard · 1 jour")
  })
  it("à venir le jour même et avant", () => {
    expect(getInstallmentStatus({ ...base, today: "2026-10-16" })).toEqual({ kind: "upcoming" })
    expect(getInstallmentStatus({ ...base, today: "2026-10-01" })).toEqual({ kind: "upcoming" })
  })
})

describe("buildInstallmentRows", () => {
  it("montant = différence entre cumuls consécutifs", () => {
    const rows = buildInstallmentRows([
      { dueDate: "2026-03-12", cumulativeAmountExpected: 90000 },
      { dueDate: "2026-06-18", cumulativeAmountExpected: 180000 },
      { dueDate: "2026-10-16", cumulativeAmountExpected: 270000 },
    ], 180000, "2026-11-05")
    expect(rows.map((r) => r.amount)).toEqual([90000, 90000, 90000])
    expect(rows.map((r) => r.status.kind)).toEqual(["paid", "paid", "overdue"])
  })
})

describe("remise / ajustement", () => {
  it("décompte d'une remise", () => {
    expect(buildOverrideBreakdown(entry({}))).toEqual({ planAmount: 300000, adjustment: -50000, amountDue: 250000, collected: 150000, balance: 100000, percent: 60 })
  })
  it("montant personnalisé", () => {
    const b = buildOverrideBreakdown(entry({ override_total_amount: 280000, discount_amount: 0 }))
    expect(b.amountDue).toBe(280000)
    expect(b.adjustment).toBe(-20000)
  })
  it("titres selon le type d'accord", () => {
    expect(getAgreementTitle(entry({}))).toBe("Remise sur frais")
    expect(getAgreementTitle(entry({ kind: "schedule" }))).toBe("Échéancier négocié")
    expect(getAgreementTitle(entry({ override_total_amount: 1 }))).toBe("Montant total personnalisé")
  })
  it("progression d'échéancier", () => {
    expect(scheduleCollectedPercent({ total_paid: 180000, remaining_due: 90000 })).toBe(67)
    expect(scheduleCollectedPercent({ total_paid: 0, remaining_due: 0 })).toBe(0)
  })
})
