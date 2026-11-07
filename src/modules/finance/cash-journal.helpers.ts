import { addDaysIso, TIMEZONE_METIER, todayInBusinessTimezone } from "@/shared/lib/business-date"
import type { CashJournal } from "./finance.api"

export type PeriodPreset = "today" | "week" | "month" | "custom"
export type JournalEntry = CashJournal["entries"][number]

export const PERIOD_PRESETS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "today", label: "Aujourd'hui" }, { value: "week", label: "Cette semaine" }, { value: "month", label: "Ce mois" }, { value: "custom", label: "Personnalisé" },
]

/** Plage de dates (ISO) d'un raccourci de période. La semaine commence le lundi. */
export function presetRange(preset: Exclude<PeriodPreset, "custom">, today = todayInBusinessTimezone()): { from: string; to: string } {
  if (preset === "today") return { from: today, to: today }
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today }
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay()
  return { from: addDaysIso(today, -((weekday + 6) % 7)), to: today }
}

export const isoToFr = (iso: string): string => iso.split("-").reverse().join("/")

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })
/** « Jeudi 5 novembre 2026 » */
export function dayLabel(iso: string): string {
  const text = dayFormatter.format(new Date(`${iso}T00:00:00.000Z`))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const cancelFormatter = new Intl.DateTimeFormat("fr-FR", { timeZone: TIMEZONE_METIER, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
/** « 6 nov., 09:14 » */
export const formatCancelledAt = (iso: string): string => cancelFormatter.format(new Date(iso)).replace(" à ", ", ").replace(/\s/g, " ")

export const pluralize = (count: number, singular: string, plural = `${singular}s`): string => (count > 1 ? plural : singular)

export type DayGroup = { date: string; entries: JournalEntry[]; confirmedCount: number; confirmedTotal: number; cancelledCount: number }

/** Regroupe par jour de paiement (ordre conservé). Les annulés ne comptent jamais dans les montants. */
export function groupByDay(entries: JournalEntry[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const entry of entries) {
    let group = groups[groups.length - 1]
    if (!group || group.date !== entry.paymentDate) {
      group = { date: entry.paymentDate, entries: [], confirmedCount: 0, confirmedTotal: 0, cancelledCount: 0 }
      groups.push(group)
    }
    group.entries.push(entry)
    if (entry.status === "cancelled") group.cancelledCount += 1
    else { group.confirmedCount += 1; group.confirmedTotal += entry.amount }
  }
  return groups
}

/** Part d'un mode dans le total confirmé, en pourcentage entier. */
export const methodShare = (amount: number, grandTotal: number): number => (grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0)
