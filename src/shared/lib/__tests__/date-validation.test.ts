import { describe, expect, it } from "vitest"
import { birthDateIssue, dateRangeIssue, updateDateRange, yesterdayInBusinessTimezone } from "../date-validation"

describe("date fields", () => {
  it("uses the business calendar day for the birth date maximum", () => {
    const now = new Date("2026-10-12T00:01:00Z")
    expect(yesterdayInBusinessTimezone(now)).toBe("2026-10-11")
    expect(birthDateIssue("2026-10-11", now)).toBeNull()
    expect(birthDateIssue("2026-10-12", now)).toContain("antérieure")
    expect(birthDateIssue("2026-02-30", now)).toContain("invalide")
    expect(birthDateIssue("", now)).toBeNull()
  })

  it("clears a conflicting bound and explains which value was cleared", () => {
    expect(updateDateRange("2026-01-01", "2026-01-31", "from", "2026-02-01"))
      .toMatchObject({ from: "2026-02-01", to: "", message: expect.stringContaining("date de fin") })
    expect(updateDateRange("2026-01-01", "2026-01-31", "to", "2025-12-31"))
      .toMatchObject({ from: "", to: "2025-12-31", message: expect.stringContaining("date de début") })
    expect(dateRangeIssue("2026-02-30", "2026-03-01")).toContain("réelles")
    expect(dateRangeIssue("2026-03-02", "2026-03-01")).toContain("date de fin")
    expect(dateRangeIssue("2026-03-01", "2026-03-01")).toBeNull()
  })
})
