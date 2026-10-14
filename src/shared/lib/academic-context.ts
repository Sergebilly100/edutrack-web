export type PeriodWithDates = { id: string; startDate: string; endDate: string }
export type PeriodWithCurrentFlag = { id: string; isCurrent: boolean; isFuture: boolean }

export function currentAcademicPeriodId<T extends PeriodWithDates>(periods: T[], today = new Date().toISOString().slice(0, 10)): string {
  const current = [...periods].filter((period) => period.startDate <= today && today <= period.endDate)
    .sort((left, right) => right.startDate.localeCompare(left.startDate))[0]
  if (current) return current.id
  return [...periods].filter((period) => period.endDate < today)
    .sort((left, right) => right.endDate.localeCompare(left.endDate) || right.startDate.localeCompare(left.startDate))[0]?.id ?? ""
}

// The evaluation options endpoint returns periods ordered by start_date DESC.
export function currentReviewPeriodId<T extends PeriodWithCurrentFlag>(periods: T[]): string {
  return periods.find((period) => period.isCurrent)?.id
    ?? periods.find((period) => !period.isFuture)?.id ?? ""
}
