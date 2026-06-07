import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { AbsentIcon, LateIcon, PresentIcon } from "@/shared/components/icons"
import { ATTENDANCE_STATUS } from "@/shared/constants"

type StatusBadgeProps = {
  status: "present" | "absent" | "late"
  lateMinutes?: number
}

const statusStyles = {
  present: {
    label: "Présent",
    className: "bg-green-100 text-green-700 border-green-200",
    Icon: PresentIcon
  },
  absent: {
    label: "Absent",
    className: "bg-red-100 text-red-700 border-red-200",
    Icon: AbsentIcon
  },
  late: {
    label: "Retard",
    className: "bg-amber-100 text-amber-900 border-amber-200",
    Icon: LateIcon
  }
} as const

export function StatusBadge({ status, lateMinutes }: StatusBadgeProps) {
  const config = statusStyles[status]
  const label = status === ATTENDANCE_STATUS.LATE ? `Retard ${lateMinutes ?? 0}min` : config.label

  return (
    <Badge
      variant="outline"
      role="status"
      aria-label={`Statut: ${label}`}
      className={cn("min-h-6 gap-1.5", config.className)}
    >
      <config.Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}
