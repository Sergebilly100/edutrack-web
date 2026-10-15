import { describe, expect, it } from "vitest"
import { daysUntil, nextAcademicDeadline, periodDateErrors, periodOverlap, timelineMonthTicks, timelinePosition } from "../academic-calendar"
import type { GradingPeriod, SchoolYear } from "@/modules/academic/academic.api"

const year = { id: "y", startDate: "2026-03-12", endDate: "2026-12-17", endOfYearReviewStartDate: "2026-11-17" } as SchoolYear
const periods = [
  { orderIndex: 1, label: "Trimestre 1", startDate: "2026-03-12", reviewStartDate: "2026-06-18", endDate: "2026-07-03" },
  { orderIndex: 2, label: "Trimestre 2", startDate: "2026-06-18", reviewStartDate: "2026-09-21", endDate: "2026-09-26" },
  { orderIndex: 3, label: "Trimestre 3", startDate: "2026-09-21", reviewStartDate: "2026-11-17", endDate: "2026-12-17" },
] as GradingPeriod[]

describe("academic calendar", () => {
  it("clamps timeline positions at both ends, including today outside the year", () => {
    expect(timelinePosition(year.startDate, year.startDate, year.endDate)).toBe(0)
    expect(timelinePosition(year.endDate, year.startDate, year.endDate)).toBe(100)
    expect(timelinePosition("2026-01-01", year.startDate, year.endDate)).toBe(0)
    expect(timelinePosition("2027-01-01", year.startDate, year.endDate)).toBe(100)
  })

  it("adapte les graduations à la durée réelle de l’année", () => {
    expect(timelineMonthTicks("2026-09-01", "2027-02-28").map((tick) => tick.date)).toEqual([
      "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01",
    ])
    const longYear = timelineMonthTicks("2025-01-15", "2027-12-20")
    expect(longYear.length).toBeLessThanOrEqual(12)
    expect(longYear[0]?.date).toBe("2025-01-15")
    expect(longYear.at(-1)?.date).toBe("2027-12-01")
    expect(timelineMonthTicks("2026-03-12", "2026-12-17").map((tick) => tick.date)).not.toContain("2026-04-01")
  })

  it("finds the next actual deadline and counts days", () => {
    expect(nextAcademicDeadline(year, periods, "2026-10-15")).toEqual({ label: "Ouverture des décisions", date: "2026-11-17" })
    expect(daysUntil("2026-11-17", "2026-10-15")).toBe(33)
    expect(nextAcademicDeadline(year, periods, "2026-12-17")).toBeNull()
  })

  it("calculates the intentional overlap with the backend date convention", () => {
    expect(periodOverlap(periods[1], periods[0])).toEqual({ start: "2026-06-18", end: "2026-07-03", days: 15 })
    expect(periodDateErrors(periods[1], year, periods[0])).toEqual({})
  })

  it("reports sequence and year-bound errors on the matching fields", () => {
    expect(periodDateErrors({ ...periods[1], startDate: "2026-07-04" }, year, periods[0]).startDate).toMatch(/au plus tard/)
    expect(periodDateErrors({ ...periods[2], endDate: "2026-12-18" }, year).endDate).toMatch(/au plus tard/)
    expect(periodDateErrors({ ...periods[2], reviewStartDate: "2026-12-18" }, year).reviewStartDate).toMatch(/entre le début et la fin/)
  })
})
