import { describe, expect, it } from "vitest"

import { dayLabel, formatCancelledAt, groupByDay, methodShare, presetRange, type JournalEntry } from "../cash-journal.helpers"

const entry = (id: string, paymentDate: string, amount: number, status: "confirmed" | "cancelled"): JournalEntry => ({
  id, paymentDate, amount, status, studentId: "s", schoolYearId: "y", method: "cash", source: "cashier_manual", providerReference: null, schoolReceiptReference: null,
  receiptNumber: `REC-${id}`, cancelledAt: null, cancellationReason: null, createdAt: "", studentMatricule: null, studentName: "N", classId: "c", className: "A", cancelledBy: null,
} as JournalEntry)

describe("cash-journal helpers", () => {
  it("computes period shortcuts", () => {
    expect(presetRange("today", "2026-11-06")).toEqual({ from: "2026-11-06", to: "2026-11-06" })
    expect(presetRange("month", "2026-11-06")).toEqual({ from: "2026-11-01", to: "2026-11-06" })
    expect(presetRange("week", "2026-11-06")).toEqual({ from: "2026-11-02", to: "2026-11-06" })
    expect(presetRange("week", "2026-11-08")).toEqual({ from: "2026-11-02", to: "2026-11-08" })
  })

  it("groups by day and never counts cancelled payments in amounts", () => {
    const groups = groupByDay([entry("1", "2026-11-05", 100000, "confirmed"), entry("2", "2026-11-05", 90000, "confirmed"), entry("3", "2026-11-05", 50000, "cancelled"), entry("4", "2026-11-04", 10, "confirmed")])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ date: "2026-11-05", confirmedCount: 2, confirmedTotal: 190000, cancelledCount: 1 })
  })

  it("formats day labels and cancellation date", () => {
    expect(dayLabel("2026-11-05")).toBe("Jeudi 5 novembre 2026")
    expect(formatCancelledAt("2026-11-06T09:14:00Z")).toContain("09:14")
  })

  it("computes the method share safely", () => {
    expect(methodShare(380000, 380000)).toBe(100)
    expect(methodShare(0, 0)).toBe(0)
  })
})
