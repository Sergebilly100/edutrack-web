import type {
  MissingEndScanSession,
  ValidationApprovalType,
  ValidationHistoryStatus,
} from "./validations.api"

export type ShortHoursHistoryFilter = "all" | "planned" | "actual" | "rejected"
export type GpsHistoryFilter = "all" | "approved" | "rejected"
export type EndScanStatus = "pending" | "warned" | "sanctioned" | "cancelled"

export const resolveShortHoursFilter = (
  filter: ShortHoursHistoryFilter
): { status?: ValidationHistoryStatus; approvalType?: ValidationApprovalType } => {
  if (filter === "all") return {}
  if (filter === "rejected") return { status: "rejected" }
  return { status: "approved", approvalType: filter }
}

export const resolveGpsFilter = (
  filter: GpsHistoryFilter
): { status?: ValidationHistoryStatus } => {
  if (filter === "all") return {}
  return { status: filter }
}

export const formatMinutes = (minutes: number | null): string => {
  if (minutes === null) return "-"
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return `${rest}min`
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`
}

export const formatDate = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export const formatTime = (value: string | null): string => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 5)
  return parsed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

export const formatFcfa = (amount: number): string =>
  `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`

export const getEndScanStatus = (session: MissingEndScanSession): EndScanStatus => {
  if (!session.endScanAction) return "pending"
  if (session.endScanActionCancelledAt) return "cancelled"
  return session.endScanAction === "warned" ? "warned" : "sanctioned"
}
