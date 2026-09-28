import { describe, expect, it } from "vitest"
import { createRuleDraftSchema, draftFrom, RULES } from "../risk-rule-form"

const lateness = RULES.find((rule) => rule.signalType === "lateness")!
const absences = RULES.find((rule) => rule.signalType === "absences")!
const grades = RULES.find((rule) => rule.signalType === "grades")!
const payments = RULES.find((rule) => rule.signalType === "payments")!

describe("validation des règles de risque", () => {
  it("ne crée pas de seuil de retards implicite", () => {
    const initial = draftFrom(lateness)
    expect(initial).toMatchObject({ thresholdValue: "", isActive: false, lateMinutes: "15", periodDays: "30" })
    expect(createRuleDraftSchema(lateness).safeParse(initial).success).toBe(false)
  })
  it.each(["", "0", "-1", "1.5", "1000", "NaN", "Infinity"])("rejette le seuil de retards %j", (thresholdValue) => {
    expect(createRuleDraftSchema(lateness).safeParse({ ...draftFrom(lateness), thresholdValue }).success).toBe(false)
  })
  it.each(["", "-1", "0.5", "Infinity"])("rejette la tolérance %j", (lateMinutes) => {
    expect(createRuleDraftSchema(lateness).safeParse({ ...draftFrom(lateness), thresholdValue: "1", lateMinutes }).success).toBe(false)
  })
  it("accepte une tolérance nulle et exige une période fixe", () => {
    const values = { ...draftFrom(lateness), thresholdValue: "1", lateMinutes: "0" }
    expect(createRuleDraftSchema(lateness).safeParse(values).success).toBe(true)
    expect(createRuleDraftSchema(lateness).safeParse({ ...values, periodDays: "31" }).success).toBe(false)
  })
  it.each(["", "0", "366", "2.5"])("rejette la période d'absences %j", (periodDays) => {
    expect(createRuleDraftSchema(absences).safeParse({ ...draftFrom(absences), periodDays }).success).toBe(false)
  })
  it("autorise une baisse décimale et le signal financier sans période", () => {
    expect(createRuleDraftSchema(grades).safeParse({ ...draftFrom(grades), thresholdValue: "1.5" }).success).toBe(true)
    expect(createRuleDraftSchema(payments).safeParse(draftFrom(payments)).success).toBe(true)
  })
})
