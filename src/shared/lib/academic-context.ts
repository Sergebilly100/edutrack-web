import { businessToday } from "@/shared/lib/academic-calendar"

export type PeriodWithDates = { id: string; startDate: string; endDate: string }
export type PeriodWithCurrentFlag = { id: string; isCurrent: boolean; isFuture: boolean }

export function currentAcademicPeriodId<T extends PeriodWithDates>(periods: T[], today = businessToday()): string {
  const current = [...periods].filter((period) => period.startDate <= today)
    .sort((left, right) => right.startDate.localeCompare(left.startDate))[0]
  return current?.id ?? ""
}

// The evaluation options endpoint returns periods ordered by start_date DESC.
export function currentReviewPeriodId<T extends PeriodWithCurrentFlag>(periods: T[]): string {
  return periods.find((period) => period.isCurrent)?.id
    ?? periods.find((period) => !period.isFuture)?.id ?? ""
}
