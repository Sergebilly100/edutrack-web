import type { GradingPeriod, SchoolYear } from "@/modules/academic/academic.api"
import { isCivilDate } from "@/shared/lib/date-validation"

export const businessToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Abidjan", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
export const dateMs = (date: string) => Date.parse(`${date}T00:00:00Z`)
export const formatAcademicDate = (date: string) => isCivilDate(date) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(dateMs(date)) : "Date indisponible"
export const daysUntil = (date: string, today: string) => isCivilDate(date) ? Math.round((dateMs(date) - dateMs(today)) / 86_400_000) : null
export const timelinePosition = (date: string, start: string, end: string) => {
  const total = dateMs(end) - dateMs(start)
  if (!Number.isFinite(total) || total <= 0 || !isCivilDate(date)) return 0
  return Math.max(0, Math.min(100, ((dateMs(date) - dateMs(start)) / total) * 100))
}
export function timelineMonthTicks(start: string, end: string, maxTicks = 12) {
  if (!isCivilDate(start) || !isCivilDate(end) || start > end) return []
  const startMonth = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1
  const endMonth = Number(end.slice(0, 4)) * 12 + Number(end.slice(5, 7)) - 1
  const count = endMonth - startMonth + 1
  const step = Math.max(1, Math.ceil((count - 1) / Math.max(1, maxTicks - 1)))
  const indices = Array.from({ length: count }, (_, index) => index)
    .filter((index) => index === 0 || index === count - 1 || index % step === 0)
  const ticks = indices.map((index) => {
    const monthIndex = startMonth + index
    const year = Math.floor(monthIndex / 12)
    const month = monthIndex % 12 + 1
    const date = index === 0 ? start : `${year}-${String(month).padStart(2, "0")}-01`
    const monthName = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(dateMs(date))
    return { date, label: `${monthName}${index === 0 || month === 1 || index === count - 1 ? ` ${String(year).slice(-2)}` : ""}` }
  })
  const spaced: typeof ticks = []
  for (const [index, tick] of ticks.entries()) {
    const previous = spaced[spaced.length - 1]
    const distance = previous ? timelinePosition(tick.date, start, end) - timelinePosition(previous.date, start, end) : 100
    if (index === ticks.length - 1 && previous && distance < 8 && spaced.length > 1) spaced.pop()
    if (index === 0 || index === ticks.length - 1 || distance >= 8) spaced.push(tick)
  }
  return spaced
}
export const nextAcademicDeadline = (year: SchoolYear, periods: GradingPeriod[], today: string) => [
  { label: "Ouverture des décisions", date: year.endOfYearReviewStartDate },
  ...periods.map((period) => ({ label: `Début de revue · ${period.label}`, date: period.reviewStartDate })),
  { label: "Fin d’année", date: year.endDate },
].filter((item) => isCivilDate(item.date) && item.date > today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null

type Dates = Pick<GradingPeriod, "startDate" | "reviewStartDate" | "endDate" | "orderIndex">
export function periodDateErrors(current: Dates, year: Pick<SchoolYear, "startDate" | "endDate">, previous?: Dates, next?: Dates) {
  const errors: Partial<Record<"startDate" | "reviewStartDate" | "endDate", string>> = {}
  for (const key of ["startDate", "reviewStartDate", "endDate"] as const) {
    if (!isCivilDate(current[key])) errors[key] = "Saisissez une date valide."
  }
  if (Object.keys(errors).length) return errors
  if (current.startDate < year.startDate) errors.startDate = `Doit être au plus tôt le ${formatAcademicDate(year.startDate)}.`
  if (current.endDate > year.endDate) errors.endDate = `Doit être au plus tard le ${formatAcademicDate(year.endDate)}.`
  if (current.startDate > current.endDate) errors.endDate = "La fin doit être postérieure ou égale au début de la période."
  if (current.startDate > current.reviewStartDate || current.reviewStartDate > current.endDate) errors.reviewStartDate = "La revue doit commencer entre le début et la fin de la période."
  if (previous) {
    if (current.startDate <= previous.startDate) errors.startDate = "Doit commencer après la période précédente."
    else if (current.startDate > previous.reviewStartDate) errors.startDate = `Doit commencer au plus tard au début de la revue de la période précédente (${formatAcademicDate(previous.reviewStartDate)}).`
    if (current.reviewStartDate <= previous.reviewStartDate) errors.reviewStartDate = "Doit commencer après la revue de la période précédente."
  }
  if (next) {
    if (next.startDate <= current.startDate) errors.startDate = "Doit précéder le début de la période suivante."
    if (next.startDate > current.reviewStartDate) errors.reviewStartDate = `Doit commencer au plus tard le ${formatAcademicDate(next.startDate)} pour recouvrir la période suivante.`
    if (next.reviewStartDate <= current.reviewStartDate) errors.reviewStartDate = "Doit précéder la revue de la période suivante."
  }
  return errors
}

export function periodOverlap(current: Dates, previous?: Dates) {
  if (!previous) return null
  const start = current.startDate > previous.startDate ? current.startDate : previous.startDate
  const end = current.endDate < previous.endDate ? current.endDate : previous.endDate
  return start <= end ? { start, end, days: Math.round((dateMs(end) - dateMs(start)) / 86_400_000) } : null
}
