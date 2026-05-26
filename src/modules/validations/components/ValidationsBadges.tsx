import { CheckCircle2, CircleX, Clock, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"

import type {
  MissingEndScanSession,
  ValidationHistoryStatus,
  ValidationKind,
} from "../validations.api"
import { getEndScanStatus } from "../validations.helpers"

const KIND_LABEL: Record<ValidationKind, string> = {
  short_hours: "Heures courtes",
  gps_suspicious: "GPS suspect",
}

export function KindBadges({ kinds }: { kinds: ValidationKind[] }) {
  if (kinds.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      {kinds.includes("short_hours") && (
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-700"
        >
          <Clock className="mr-1 h-3 w-3" />
          {KIND_LABEL.short_hours}
        </Badge>
      )}
      {kinds.includes("gps_suspicious") && (
        <Badge
          variant="outline"
          className="border-rose-200 bg-rose-50 text-rose-700"
        >
          <MapPin className="mr-1 h-3 w-3" />
          {KIND_LABEL.gps_suspicious}
        </Badge>
      )}
    </div>
  )
}

export function HistoryStatusBadge({
  status,
  kind,
  validatedHours,
  scheduleDurationMinutes,
}: {
  status: ValidationHistoryStatus
  kind: "short_hours" | "gps_suspicious"
  validatedHours?: number | null
  scheduleDurationMinutes?: number
}) {
  if (status === "approved") {
    let label = "Présence validée"
    let color_class = "border-emerald-200 bg-emerald-50 text-emerald-700"
    if (kind === "short_hours") {
      const scheduledH = (scheduleDurationMinutes ?? 0) / 60
      const isRealHours =
        validatedHours !== null &&
        validatedHours !== undefined &&
        validatedHours < scheduledH - 0.01
      label = isRealHours ? "Heure réelle accordée" : "Heure prévue accordée"
      color_class = isRealHours ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
    }
    return (
      <Badge
        variant="outline"
        className={color_class}
      >
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {label}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
      <CircleX className="mr-1 h-3 w-3" />
      {kind === "short_hours" ? "Cours non comptabilisé" : "Marqué absent"}
    </Badge>
  )
}

export function EndScanStatusBadge({ session }: { session: MissingEndScanSession }) {
  const status = getEndScanStatus(session)

  if (status === "pending") {
    return (
      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
        En attente
      </Badge>
    )
  }
  if (status === "cancelled") {
    return (
      <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-600">
        Sanction annulée
      </Badge>
    )
  }
  if (status === "warned") {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700"
      >
        Averti
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
      Sanctionné
    </Badge>
  )
}
