import { describe, expect, it } from "vitest"

import type { SalaryTeacherDetails } from "../salaries.api"
import { computePayAmount, countCourses, formatTimeRange, getHoursRemainingToPay, matchesCourseFilter, pluralize, validateHoursToPay } from "../salaries.helpers"

const details = (over: Partial<SalaryTeacherDetails["summary"]> = {}): SalaryTeacherDetails => ({
  teacher: { id: "t", name: "Prof", type: "vacataire", hourlyRate: 3500, monthlySalary: null },
  summary: { hoursPlanned: 66, hoursDone: 66, totalFcfa: null, status: "pending", absenceHours: 0, remainingPlannedHours: 0, currentEarnedAmount: 0, amountAlreadyPaid: 0, amountRemainingToPayNow: 0, remainingPotentialAmount: 0, absenceAmount: 0, hoursDoneSinceLastPayment: 0, isPartiallyPaid: false, ...over },
  payment: { paidAt: null, paidBy: null, paidByName: null, paidByRole: null, notes: null },
  payments: [],
  rows: [],
})

describe("validateHoursToPay", () => {
  it("accepte virgule et point", () => {
    expect(validateHoursToPay("10,5", 66)).toEqual({ hours: 10.5, error: null })
    expect(validateHoursToPay("40", 66)).toEqual({ hours: 40, error: null })
  })
  it("refuse zéro, négatif et texte", () => {
    expect(validateHoursToPay("0", 66).error).toMatch(/supérieur à 0/)
    expect(validateHoursToPay("-3", 66).error).toMatch(/supérieur à 0/)
    expect(validateHoursToPay("abc", 66).hours).toBeNull()
    expect(validateHoursToPay("abc", 66).error).toBeTruthy()
  })
  it("refuse au-delà du maximum et accepte le maximum exact", () => {
    expect(validateHoursToPay("66,5", 66).error).toMatch(/maximum/)
    expect(validateHoursToPay("66", 66).hours).toBe(66)
  })
  it("saisie vide : pas d'erreur, pas de valeur", () => {
    expect(validateHoursToPay("  ", 66)).toEqual({ hours: null, error: null })
  })
})

describe("montants et heures", () => {
  it("calcule le montant arrondi", () => {
    expect(computePayAmount(40, 3500)).toBe(140000)
    expect(computePayAmount(1.5, null)).toBe(0)
  })
  it("reste à payer = effectuées − déjà payées, jamais négatif", () => {
    expect(getHoursRemainingToPay(details())).toBe(66)
    expect(getHoursRemainingToPay(details({ amountAlreadyPaid: 140000 }))).toBe(26)
    expect(getHoursRemainingToPay(details({ amountAlreadyPaid: 999999 }))).toBe(0)
  })
  it("pluralise", () => {
    expect(pluralize(1, "cours", "cours")).toBe("cours")
    expect(pluralize(7, "autre cours", "autres cours")).toBe("autres cours")
  })
  it("formate un horaire", () => {
    expect(formatTimeRange("07:30:00", "08:30:00")).toContain("07:30")
  })
})

describe("filtres de cours", () => {
  const rows = [
    { attendanceStatus: "absent" }, { attendanceStatus: "present" }, { attendanceStatus: "late" }, { attendanceStatus: "not_marked" },
  ] as SalaryTeacherDetails["rows"]
  it("compte par catégorie", () => {
    expect(countCourses(rows)).toEqual({ all: 4, absent: 1, done: 2, upcoming: 1 })
    expect(rows.filter((r) => matchesCourseFilter(r, "done"))).toHaveLength(2)
  })
})
