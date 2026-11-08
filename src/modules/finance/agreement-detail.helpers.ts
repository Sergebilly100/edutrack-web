import type { AgreementRegisterEntry, AgreementStatus, TuitionScheduleStep } from "./finance.api"
import { toPercent } from "@/shared/components/ProgressMeter"

/** Libellés de statut partagés par le registre et les fenêtres de détail (même vocabulaire partout). */
export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  active: "Actif",
  withdrawn: "Retiré",
  replaced: "Remplacé",
  reset: "Réinitialisé",
}

export const EMPTY_AGREEMENT_HISTORY = "Aucun événement enregistré pour cet accord."
export const ARCHIVED_USER_LABEL = "Ancien utilisateur (archivé)"

const DAY_MS = 86_400_000
const toUtcDay = (iso: string): number => {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number)
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

/** Nombre de jours calendaires entre deux dates ISO (positif si `to` est après `from`). */
export const daysBetween = (fromIso: string, toIso: string): number => Math.round((toUtcDay(toIso) - toUtcDay(fromIso)) / DAY_MS)

export type InstallmentStatus =
  | { kind: "paid" }
  | { kind: "overdue"; daysLate: number }
  | { kind: "upcoming" }

/**
 * Statut d'une échéance :
 *  - « Payée » si le cumul encaissé couvre le cumul attendu ;
 *  - « En retard » si la date prévue est strictement passée (jour de l'école) et le cumul non couvert ;
 *  - « À venir » sinon (y compris le jour même de l'échéance).
 * `today` est fourni par l'appelant (date du jour dans le fuseau de l'école) pour rester pur et testable.
 */
export const getInstallmentStatus = (input: { dueDate: string; cumulativeExpected: number; totalPaid: number; today: string }): InstallmentStatus => {
  if (input.totalPaid >= input.cumulativeExpected) return { kind: "paid" }
  const daysLate = daysBetween(input.dueDate, input.today)
  if (daysLate > 0) return { kind: "overdue", daysLate }
  return { kind: "upcoming" }
}

export const installmentStatusLabel = (status: InstallmentStatus): string => {
  if (status.kind === "paid") return "Payée"
  if (status.kind === "overdue") return `En retard · ${status.daysLate} ${status.daysLate > 1 ? "jours" : "jour"}`
  return "À venir"
}

export type InstallmentRow = { number: number; dueDate: string; amount: number; cumulativeExpected: number; status: InstallmentStatus }

/** Montant de chaque échéance = différence entre cumuls attendus consécutifs (la première part de 0). */
export const buildInstallmentRows = (steps: ReadonlyArray<TuitionScheduleStep>, totalPaid: number, today: string): InstallmentRow[] => {
  let previous = 0
  return steps.map((step, index) => {
    const amount = step.cumulativeAmountExpected - previous
    previous = step.cumulativeAmountExpected
    return {
      number: index + 1,
      dueDate: step.dueDate,
      amount,
      cumulativeExpected: step.cumulativeAmountExpected,
      status: getInstallmentStatus({ dueDate: step.dueDate, cumulativeExpected: step.cumulativeAmountExpected, totalPaid, today }),
    }
  })
}

export const isCustomTotalOverride = (entry: Pick<AgreementRegisterEntry, "override_total_amount">): boolean => entry.override_total_amount > 0

export const getAgreementTitle = (entry: Pick<AgreementRegisterEntry, "kind" | "override_total_amount">): string => {
  if (entry.kind === "schedule") return "Échéancier négocié"
  return isCustomTotalOverride(entry) ? "Montant total personnalisé" : "Remise sur frais"
}

export type OverrideBreakdown = {
  planAmount: number
  /** Écart appliqué au plan : négatif = réduction (remise), positif = majoration. */
  adjustment: number
  amountDue: number
  collected: number
  balance: number
  percent: number
}

/** Décompte d'une remise / d'un ajustement : plan de référence → montant dû → solde (le solde vient du serveur). */
export const buildOverrideBreakdown = (entry: AgreementRegisterEntry): OverrideBreakdown => {
  const amountDue = isCustomTotalOverride(entry)
    ? entry.override_total_amount
    : Math.max(0, entry.plan_total_amount - entry.discount_amount)
  return {
    planAmount: entry.plan_total_amount,
    adjustment: amountDue - entry.plan_total_amount,
    amountDue,
    collected: entry.total_paid,
    balance: entry.remaining_due,
    percent: toPercent(entry.total_paid, amountDue),
  }
}

/** Progression d'un échéancier : encaissé / (encaissé + solde). */
export const scheduleCollectedPercent = (entry: Pick<AgreementRegisterEntry, "total_paid" | "remaining_due">): number =>
  toPercent(entry.total_paid, entry.total_paid + entry.remaining_due)

export const AGREEMENT_VIEW_PERMISSIONS = ["tuition.view", "tuition.grant_discount", "tuition.manage_student_schedule"] as const
