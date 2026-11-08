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
    return "border-amber-200 bg-amber-50 text-amber-900"
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
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  absent: {
    label: "Absent",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  not_marked: {
    label: "Non pointé",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
}

// ---------------------------------------------------------------------------
// Fenêtres « Marquer comme payé » et « Détails salaire » (vacataires)
// Fonctions pures : mêmes formules et mêmes arrondis que l'ancien code de page.
// ---------------------------------------------------------------------------

const roundTwo = (value: number): number => Math.round(value * 100) / 100

/** Heures déjà payées : montant payé / taux horaire si possible, sinon somme des heures des paiements. */
export const getHoursAlreadyPaid = (details: SalaryTeacherDetails | null): number => {
  if (!details) return 0
  if (
    details.teacher.type === "vacataire" &&
    details.teacher.hourlyRate !== null &&
    details.summary.amountAlreadyPaid !== null
  ) {
    return roundTwo(details.summary.amountAlreadyPaid / details.teacher.hourlyRate)
  }
  return details.payments.reduce((sum, item) => sum + (item.hoursPaid ?? 0), 0)
}

/** Heures restant à payer = heures effectuées − heures déjà payées (jamais négatif). */
export const getHoursRemainingToPay = (details: SalaryTeacherDetails | null): number => {
  if (!details) return 0
  return Math.max(0, roundTwo(details.summary.hoursDone - getHoursAlreadyPaid(details)))
}

/** Montant FCFA d'un nombre d'heures (arrondi à l'unité, comme l'affichage historique). */
export const computePayAmount = (hours: number, hourlyRate: number | null): number =>
  hourlyRate === null ? 0 : Math.round(hours * hourlyRate)

/** Nombre d'heures décimal en français : « 66 h », « 10,5 h ». */
export const formatHoursCount = (value: number): string =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(roundTwo(value))}\u00A0h`

export type HoursToPayValidation = { hours: number | null; error: string | null }

/**
 * Validation de la saisie « nombre d'heures précis » : strictement > 0, ≤ reste à payer,
 * décimales avec virgule ou point. Une saisie vide n'affiche pas d'erreur (bouton simplement désactivé).
 */
export const validateHoursToPay = (input: string, maxHours: number): HoursToPayValidation => {
  const normalized = input.replace(",", ".").trim()
  if (!normalized) return { hours: null, error: null }
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return { hours: null, error: "Saisissez un nombre d'heures valide (ex. 10,5)." }
  }
  const hours = roundTwo(parsed)
  if (hours <= 0) {
    return { hours: null, error: "Le nombre d'heures doit être supérieur à 0." }
  }
  if (hours - maxHours > 0.0001) {
    return { hours: null, error: `Le nombre d'heures dépasse le reste à payer (maximum : ${formatHoursCount(maxHours)}).` }
  }
  return { hours, error: null }
}

export const pluralize = (count: number, singular: string, plural: string): string =>
  count > 1 ? plural : singular

export type SalaryStatusTone = "success" | "danger" | "warning" | "neutral"

/** Ton de la pastille du statut de paie (le texte reste toujours affiché dans la pastille). */
export const getSalaryStatusTone = (
  row: SalarySummaryItem,
  details: SalaryTeacherDetails | null
): SalaryStatusTone => {
  if (row.status === "disputed") return "danger"
  if (row.status === "nothing_to_pay") return "neutral"
  if (details?.summary.isPartiallyPaid || row.isPartiallyPaid) return "warning"
  if (row.status === "paid") return "success"
  return "warning"
}

export type CourseFilter = "all" | "absent" | "done" | "upcoming"
type CourseRow = SalaryTeacherDetails["rows"][number]

export const matchesCourseFilter = (row: CourseRow, filter: CourseFilter): boolean => {
  switch (filter) {
    case "absent":
      return row.attendanceStatus === "absent"
    case "done":
      return row.attendanceStatus === "present" || row.attendanceStatus === "late"
    case "upcoming":
      return row.attendanceStatus === "not_marked"
    default:
      return true
  }
}

export const countCourses = (rows: ReadonlyArray<CourseRow>): Record<CourseFilter, number> => ({
  all: rows.length,
  absent: rows.filter((row) => matchesCourseFilter(row, "absent")).length,
  done: rows.filter((row) => matchesCourseFilter(row, "done")).length,
  upcoming: rows.filter((row) => matchesCourseFilter(row, "upcoming")).length,
})

/** « lun. 2 nov. » depuis une date ISO (jour calendaire, sans décalage de fuseau). */
export const formatCourseDate = (isoDate: string): string => {
  const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(parsed)
}

/** « 07:30 – 08:30 » depuis des heures « HH:MM » ou « HH:MM:SS ». */
export const formatTimeRange = (start: string, end: string): string =>
  `${start.slice(0, 5)}\u00A0–\u00A0${end.slice(0, 5)}`
