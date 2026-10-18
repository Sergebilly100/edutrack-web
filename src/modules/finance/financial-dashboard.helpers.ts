import type { PaymentMethod } from "./finance.api"

type FinancialAmount = number | string

export const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: "hsl(var(--primary))",
  mobile_money: "var(--stat-success-fg)",
  bank_transfer: "var(--stat-warning-fg)",
}

const amount = (value: FinancialAmount): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error("Montant financier invalide.")
  }
  return parsed
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100

export const parseFinancialAmount = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null
  if (typeof value === "string" && value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const calculateToDateBalance = (
  expectedToDate: FinancialAmount,
  collected: FinancialAmount,
): number => roundMoney(amount(expectedToDate) - amount(collected))

export const calculateAnnualRemainingBalance = (
  annualTotalDue: FinancialAmount,
  collected: FinancialAmount,
): number => roundMoney(amount(annualTotalDue) - amount(collected))

export const RECOVERY_RATE_THRESHOLDS = {
  warning: 85,
  success: 95,
} as const

export type RecoveryTone = "success" | "warning" | "danger"

export const recoveryRatePercent = (
  expected: FinancialAmount,
  collected: FinancialAmount,
): number => {
  const expectedAmount = amount(expected)
  if (expectedAmount <= 0) return 100
  return Math.round((amount(collected) / expectedAmount) * 100)
}

export const recoveryProgressValue = (rate: number): number =>
  Math.max(0, Math.min(100, rate))

export const recoveryTone = (rate: number): RecoveryTone => {
  if (rate >= RECOVERY_RATE_THRESHOLDS.success) return "success"
  if (rate >= RECOVERY_RATE_THRESHOLDS.warning) return "warning"
  return "danger"
}

export const calculateFinancialBalances = (input: {
  expectedToDate: FinancialAmount
  collected: FinancialAmount
  annualTotalDue: FinancialAmount
}): {
  overdueToDate: number
  annualRemaining: number
  upcomingDue: number
} => {
  const collected = amount(input.collected)
  const overdueToDate = calculateToDateBalance(input.expectedToDate, collected)
  const annualRemaining = calculateAnnualRemainingBalance(input.annualTotalDue, collected)

  return {
    overdueToDate,
    annualRemaining,
    upcomingDue: roundMoney(annualRemaining - overdueToDate),
  }
}
