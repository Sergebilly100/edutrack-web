import { describe, expect, it } from "vitest"
import { currentAcademicPeriodId, currentReviewPeriodId } from "../academic-context"

describe("academic period defaults", () => {
  const periods = [
    { id: "future", startDate: "2026-11-01", endDate: "2027-01-31" },
    { id: "old", startDate: "2026-01-01", endDate: "2026-03-31" },
    { id: "recent", startDate: "2026-04-01", endDate: "2026-06-30" },
    { id: "current", startDate: "2026-09-01", endDate: "2026-10-31" },
  ]

  it("chooses the period containing today, including its end date", () => {
    expect(currentAcademicPeriodId(periods, "2026-10-14")).toBe("current")
    expect(currentAcademicPeriodId(periods, "2026-10-31")).toBe("current")
  })

  it("chooses the most recently started period when dates overlap", () => {
    expect(currentAcademicPeriodId([
      { id: "earlier", startDate: "2026-09-01", endDate: "2026-10-31" },
      { id: "later", startDate: "2026-10-01", endDate: "2026-12-31" },
    ], "2026-10-14")).toBe("later")
  })

  it("chooses the latest elapsed period when none contains today", () => {
    expect(currentAcademicPeriodId(periods, "2026-07-01")).toBe("recent")
    expect(currentAcademicPeriodId(periods, "2025-12-01")).toBe("")
  })

  it("uses the API current flag then the latest elapsed review period", () => {
    expect(currentReviewPeriodId([
      { id: "recent", isCurrent: false, isFuture: false },
      { id: "current", isCurrent: true, isFuture: false },
    ])).toBe("current")
    expect(currentReviewPeriodId([
      { id: "future", isCurrent: false, isFuture: true },
      { id: "recent", isCurrent: false, isFuture: false },
      { id: "old", isCurrent: false, isFuture: false },
    ])).toBe("recent")
  })
})
