import type { SalaryStatus } from "@/shared/components/SalaryRow"

import type {
  DashboardCourseItem,
  DashboardSalarySummaryItem,
} from "./dashboard.api"

export const QUERY_STALE_TIME = 60_000
export const TODAY_REFETCH_INTERVAL = 120_000

export const formatToday = (value: Date) =>
  value.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

export const formatHours = (value: string): string => {
  if (!value) {
    return "--:--"
  }

  if (/^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const buildCourseDateTime = (date: string, time: string): Date | null => {
  if (!date || !time) {
    return null
  }

  const normalizedTime = /^\d{2}:\d{2}/.test(time) ? time.slice(0, 8) : time
  const parsed = new Date(`${date}T${normalizedTime}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const isPresentLikeCourse = (course: DashboardCourseItem): boolean =>
  course.status === "present" || course.status === "late"

export const hasCourseStartedFor15Minutes = (
  date: string,
  startTime: string,
  now: Date
): boolean => {
  const startsAt = buildCourseDateTime(date, startTime)
  if (!startsAt) {
    return false
  }

  return now.getTime() - startsAt.getTime() >= 15 * 60 * 1000
}

export const courseStatusMeta: Record<string, { label: string; className: string }> = {
  present: {
    label: "Présent",
    className:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200",
  },
  late: {
    label: "Retard",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200",
  },
  absent: {
    label: "Absent",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
  },
  default: {
    label: "En attente",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
}

export type DashboardSalaryRow = DashboardSalarySummaryItem & {
  salaryRowStatus: SalaryStatus
  salaryStatusLabel?: string
  salaryStatusClassName?: string
}

export const toDashboardSalaryRow = (
  item: DashboardSalarySummaryItem
): DashboardSalaryRow => {
  if (item.status === "Salaire fixe") {
    return {
      ...item,
      salaryRowStatus: "paid",
      salaryStatusLabel: "Salaire fixe",
      salaryStatusClassName: "border-slate-200 bg-slate-50 text-slate-700",
    }
  }

  if (item.status !== "disputed" && item.isPartiallyPaid) {
    return {
      ...item,
      salaryRowStatus: item.status === "pending" ? "pending" : "paid",
      salaryStatusLabel: "Payé partiellement",
      salaryStatusClassName: "border-amber-200 bg-amber-50 text-amber-700",
    }
  }

  if (item.status === "nothing_to_pay") {
    return {
      ...item,
      salaryRowStatus: "nothing_to_pay",
      salaryStatusLabel: "Rien à payer",
      salaryStatusClassName: "border-slate-200 bg-slate-50 text-slate-700",
    }
  }

  return {
    ...item,
    salaryRowStatus: item.status,
  }
}
