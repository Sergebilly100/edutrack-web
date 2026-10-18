import { describe, expect, it } from "vitest"

import {
  calculateFinancialBalances,
  calculateAnnualRemainingBalance,
  calculateToDateBalance,
  PAYMENT_METHOD_COLORS,
  parseFinancialAmount,
  RECOVERY_RATE_THRESHOLDS,
  recoveryProgressValue,
  recoveryRatePercent,
  recoveryTone,
} from "../financial-dashboard.helpers"

describe("financial dashboard helpers", () => {
  it("keeps the to-date and annual balance equations exact", () => {
    const balances = calculateFinancialBalances({
      expectedToDate: 14_220_000,
      collected: 13_140_000,
      annualTotalDue: 21_420_000,
    })

    expect(balances.overdueToDate).toBe(1_080_000)
    expect(balances.annualRemaining).toBe(8_280_000)
    expect(balances.upcomingDue).toBe(7_200_000)
    expect(balances.overdueToDate + balances.upcomingDue).toBe(balances.annualRemaining)
  })

  it("parses optional API amounts without treating missing values as zero", () => {
    expect(parseFinancialAmount("600000")).toBe(600_000)
    expect(parseFinancialAmount(null)).toBeNull()
    expect(parseFinancialAmount(undefined)).toBeNull()
    expect(parseFinancialAmount("")).toBeNull()
    expect(parseFinancialAmount("not-a-number")).toBeNull()
    expect(calculateToDateBalance(600_000, 420_000)).toBe(180_000)
    expect(calculateAnnualRemainingBalance(1_000_000, 840_000)).toBe(160_000)
  })

  it("represents payments in advance as a negative net to-date balance", () => {
    const balances = calculateFinancialBalances({
      expectedToDate: 100_000,
      collected: 150_000,
      annualTotalDue: 300_000,
    })

    expect(balances.overdueToDate).toBe(-50_000)
    expect(balances.annualRemaining).toBe(150_000)
    expect(balances.upcomingDue).toBe(200_000)
    expect(balances.annualRemaining).toBe(balances.overdueToDate + balances.upcomingDue)
  })

  it("uses the proposed named recovery thresholds", () => {
    expect(RECOVERY_RATE_THRESHOLDS).toEqual({ warning: 85, success: 95 })
    expect(recoveryTone(95)).toBe("success")
    expect(recoveryTone(94)).toBe("warning")
    expect(recoveryTone(85)).toBe("warning")
    expect(recoveryTone(84)).toBe("danger")
  })

  it("uses valid semantic colors for every payment-method donut sector", () => {
    expect(PAYMENT_METHOD_COLORS).toEqual({
      cash: "hsl(var(--primary))",
      mobile_money: "var(--stat-success-fg)",
      bank_transfer: "var(--stat-warning-fg)",
    })
    expect(PAYMENT_METHOD_COLORS.mobile_money).not.toContain("hsl(var(--stat-")
    expect(PAYMENT_METHOD_COLORS.bank_transfer).not.toContain("hsl(var(--stat-")
  })

  it("keeps the displayed rate exact while limiting the progress bar to its range", () => {
    expect(recoveryRatePercent(200, 210)).toBe(105)
    expect(recoveryProgressValue(105)).toBe(100)
    expect(recoveryRatePercent(0, 0)).toBe(100)
  })
})
