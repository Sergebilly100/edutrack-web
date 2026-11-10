import type { FinancialStatus, Payment } from "./finance.api"
import { toPercent } from "@/shared/components/ProgressMeter"

type PaymentWithBalance = Payment & { balanceAfter: number }

/** Plus récent d'abord : date de paiement décroissante, puis date de saisie décroissante. */
export const sortPaymentsMostRecentFirst = <T extends Pick<Payment, "paymentDate" | "createdAt">>(payments: ReadonlyArray<T>): T[] =>
  [...payments].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.createdAt.localeCompare(a.createdAt))

export type PaymentsSummary = { count: number; total: number }

/** Paiements confirmés uniquement : leur somme correspond au « Cumul versé ». */
export const summarizeConfirmedPayments = (payments: ReadonlyArray<Pick<PaymentWithBalance, "status" | "amount">>): PaymentsSummary => {
  const confirmed = payments.filter((payment) => payment.status === "confirmed")
  return { count: confirmed.length, total: confirmed.reduce((sum, payment) => sum + payment.amount, 0) }
}

export type FinancialGap = { percentPaid: number; isLate: boolean; threshold: number; missing: number }

/** Progression et écart au seuil attendu (valeurs serveur ; aucun recalcul du dû côté interface). */
export const buildFinancialGap = (status: Pick<FinancialStatus, "totalDue" | "confirmedPaid" | "cumulativeExpectedAtDate" | "standing">): FinancialGap => ({
  percentPaid: toPercent(status.confirmedPaid, status.totalDue),
  isLate: status.standing === "late",
  threshold: status.cumulativeExpectedAtDate,
  missing: Math.max(0, status.cumulativeExpectedAtDate - status.confirmedPaid),
})

/** Ligne « Remise » près du Total dû : seulement si une remise active existe (jamais « 0 FCFA »). */
export const hasActiveDiscount = (status: Pick<FinancialStatus, "discountAmount">): boolean => status.discountAmount > 0

export const paymentPlural = (count: number): string => `${count} paiement${count > 1 ? "s" : ""}`
