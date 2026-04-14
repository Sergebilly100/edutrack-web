import { CheckCircle2, Clock, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusBadgeProps = {
  status: "present" | "absent" | "late"
  lateMinutes?: number
}

const statusStyles = {
  present: {
    label: "Présent",
    className: "bg-green-100 text-green-700 border-green-200",
    Icon: CheckCircle2
  },
  absent: {
    label: "Absent",
    className: "bg-red-100 text-red-700 border-red-200",
    Icon: XCircle
  },
  late: {
    label: "Retard",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    Icon: Clock
  }
} as const

export function StatusBadge({ status, lateMinutes }: StatusBadgeProps) {
  const config = statusStyles[status]
  const label = status === "late" ? `Retard ${lateMinutes ?? 0}min` : config.label

  return (
    <Badge variant="outline" className={cn("gap-1.5", config.className)}>
      <config.Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}
