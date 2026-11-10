import { describe, expect, it } from "vitest"

import type { TuitionPlan } from "../finance.api"
import { planFormMatchesSaved } from "../tuition-copy"

const plan: TuitionPlan = {
  id: "p", levelId: "l", levelName: "6ème", schoolYearId: "y", schoolYearLabel: "2026-2027",
  totalAmount: 180000, registrationAmount: 25000, currency: "FCFA",
  scheduleSteps: [{ dueDate: "2026-10-01", cumulativeAmountExpected: 80000 }],
}
const form = { totalAmount: "180000", registrationAmount: "25000", steps: [{ dueDate: "2026-10-01", cumulativeAmountExpected: 80000 }] }

describe("planFormMatchesSaved", () => {
  it("accepte un formulaire identique au plan enregistré", () => expect(planFormMatchesSaved(plan, form)).toBe(true))
  it("refuse sans plan enregistré", () => expect(planFormMatchesSaved(undefined, form)).toBe(false))
  it("refuse dès qu'un montant ou une échéance a changé", () => {
    expect(planFormMatchesSaved(plan, { ...form, totalAmount: "200000" })).toBe(false)
    expect(planFormMatchesSaved(plan, { ...form, registrationAmount: "0" })).toBe(false)
    expect(planFormMatchesSaved(plan, { ...form, steps: [{ dueDate: "2026-10-02", cumulativeAmountExpected: 80000 }] })).toBe(false)
    expect(planFormMatchesSaved(plan, { ...form, steps: [...form.steps, { dueDate: "", cumulativeAmountExpected: 0 }] })).toBe(true)
    expect(planFormMatchesSaved(plan, { ...form, steps: [] })).toBe(false)
  })
})
