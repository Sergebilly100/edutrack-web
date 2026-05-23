import { formatFcfa } from "@/shared/utils/formatting"
import type {
  SalarySummaryItem,
  SalaryTeacherDetails,
} from "@/modules/salaries/salaries.api"

export const STALE_TIME = 60_000

export const resolveDownloadFileName = (downloadUrl: string | null): string | null => {
  if (!downloadUrl) {
    return null
  }

  try {
    const url = new URL(downloadUrl, window.location.origin)
    const segments = url.pathname.split("/").filter(Boolean)
    const lastSegment = segments.length > 0 ? segments[segments.length - 1] : null
    if (!lastSegment) {
      return null
    }
    return decodeURIComponent(lastSegment)
  } catch {
    return null
  }
}

export const toSalaryRowStatus = (
  value: SalarySummaryItem["status"]
): "pending" | "paid" | "disputed" | "nothing_to_pay" | null => {
  if (
    value === "pending" ||
    value === "paid" ||
    value === "disputed" ||
    value === "nothing_to_pay"
  ) {
    return value
  }

  return null
}

export const formatHours = (value: number): string =>
  `${Math.round(value * 100) / 100}h`

export const parseHoursInput = (value: string): number | null => {
  const normalized = value.replace(",", ".").trim()
  if (!normalized) {
    return null
  }
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.round(parsed * 100) / 100
}

export const getSchoolYearBounds = (
  referenceMonth: string
): { start: string; end: string; label: string } => {
  const [yearRaw, monthRaw] = referenceMonth.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const startYear = month >= 9 ? year : year - 1
  const endYear = startYear + 1
  return {
    start: `${startYear}-09`,
    end: `${endYear}-08`,
    label: `${startYear}-${endYear}`,
  }
}

export const formatSalaryDescriptor = (
  row: SalarySummaryItem | null,
  details: SalaryTeacherDetails | null
): string => {
  if (!row) {
    return ""
  }

  const hourlyRate = details?.teacher.hourlyRate ?? row.hourlyRate
  if (hourlyRate !== null) {
    return `${formatFcfa(hourlyRate)} / heure`
  }

  const monthlyFixedAmount = details?.summary.totalFcfa ?? row.totalFcfa
  if (monthlyFixedAmount !== null) {
    return `${formatFcfa(monthlyFixedAmount)} / mois`
  }

  return "Salaire fixe (mensuel)"
}

export const toDisplayedStatus = (
  row: SalarySummaryItem,
  details: SalaryTeacherDetails | null
): string => {
  if (row.status === "disputed") {
    return "Litige"
  }
  if (row.status === "nothing_to_pay") {
    return "Rien à payer"
  }
  if (details?.summary.isPartiallyPaid || row.isPartiallyPaid) {
    return "Payé partiellement"
  }
  if (row.status === "paid") {
    return "Payé"
  }
  return "En attente"
}

export const getStatusBadgeClass = (
  status: SalarySummaryItem["status"],
  isPartiallyPaid: boolean
): string => {
  if (isPartiallyPaid) {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }
  if (status === "disputed") {
    return "border-red-200 bg-red-50 text-red-700"
  }
  if (status === "nothing_to_pay") {
    return "border-slate-200 bg-slate-50 text-slate-700"
  }
  if (status === "paid") {
    return "border-green-200 bg-green-50 text-green-700"
  }
  return "border-slate-200 bg-slate-50 text-slate-700"
}

export const attendanceStatusMeta: Record<
  SalaryTeacherDetails["rows"][number]["attendanceStatus"],
  { label: string; className: string }
> = {
  present: {
    label: "Présent",
    className: "border-green-200 bg-green-50 text-green-700",
  },
  late: {
    label: "En retard",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  absent: {
    label: "Absent",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  excused: {
    label: "Absence justifiée",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  not_marked: {
    label: "Non pointé",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
}
