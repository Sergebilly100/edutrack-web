import { describe, expect, it } from "vitest"

import { buildFinancialGap, formatPaymentDate, hasActiveDiscount, sortPaymentsMostRecentFirst, summarizeConfirmedPayments } from "../payment-detail.helpers"

describe("formatPaymentDate", () => {
  it("n'affiche jamais 00:00 pour une date seule", () => {
    expect(formatPaymentDate("2026-11-05").time).toBeNull()
    expect(formatPaymentDate("2026-11-05T00:00:00").time).toBeNull()
    expect(formatPaymentDate("2026-11-05").date).toContain("2026")
  })
  it("affiche l'heure quand elle est connue", () => {
    expect(formatPaymentDate("2026-11-05T14:30:00Z").time).toContain("14")
  })
})

describe("liste et synthèse", () => {
  it("trie du plus récent au plus ancien", () => {
    const sorted = sortPaymentsMostRecentFirst([
      { paymentDate: "2026-11-01", createdAt: "a" }, { paymentDate: "2026-11-05", createdAt: "a" }, { paymentDate: "2026-11-05", createdAt: "b" },
    ])
    expect(sorted.map((p) => p.createdAt + p.paymentDate)).toEqual(["b2026-11-05", "a2026-11-05", "a2026-11-01"])
  })
  it("ne compte que les paiements confirmés", () => {
    expect(summarizeConfirmedPayments([{ status: "confirmed", amount: 100000 }, { status: "confirmed", amount: 100000 }, { status: "cancelled", amount: 5000 }])).toEqual({ count: 2, total: 200000 })
  })
  it("remise affichée seulement si > 0", () => {
    expect(hasActiveDiscount({ discountAmount: 50000 })).toBe(true)
    expect(hasActiveDiscount({ discountAmount: 0 })).toBe(false)
  })
  it("écart au seuil", () => {
    expect(buildFinancialGap({ totalDue: 300000, confirmedPaid: 200000, cumulativeExpectedAtDate: 300000, standing: "late" })).toEqual({ percentPaid: 67, isLate: true, threshold: 300000, missing: 100000 })
  })
})
