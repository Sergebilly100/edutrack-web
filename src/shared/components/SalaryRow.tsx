import { CheckCircle2, Clock3, FileText, History, WalletCards } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { getAvatarColor, getInitials } from "@/shared/utils/avatar"
import { formatFcfa } from "@/shared/utils/formatting"

import type { SalaryStatus } from "@/shared/utils/salary-helpers"
export type { SalaryStatus } from "@/shared/utils/salary-helpers"

export interface SalaryRowTeacher {
  id: string
  name: string
  type: "vacataire" | "permanent"
}

export interface SalaryRowPeriodSummary {
  hoursDone: number
  hoursPlanned: number
  amountFcfa: number
  status: SalaryStatus
  canMarkPaid?: boolean
  isPartiallyPaid?: boolean
  statusLabel?: string
  statusClassName?: string
}

export interface SalaryRowProps {
  teacher: SalaryRowTeacher
  periodSummary: SalaryRowPeriodSummary
  onMarkPaid: (teacherId: string) => void
  onDetails: (teacherId: string) => void
  onHistory?: (teacherId: string) => void
  dataTestIdPrefix?: string
}

const teacherTypeMeta: Record<SalaryRowTeacher["type"], { label: string; className: string }> = {
  vacataire: {
    label: "Vacataire",
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200",
  },
  permanent: {
    label: "Permanent",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
}

const statusMeta: Record<SalaryStatus, { label: string; className: string; icon: typeof Clock3 }> = {
  pending: {
    label: "En attente",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200",
    icon: Clock3,
  },
  paid: {
    label: "Payé",
    className: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200",
    icon: CheckCircle2,
  },
  disputed: {
    label: "Litige",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
    icon: FileText,
  },
  nothing_to_pay: {
    label: "Rien à payer",
    className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    icon: CheckCircle2,
  },
}


const getProgressColor = (ratio: number) => {
  if (ratio >= 90) {
    return "bg-green-500"
  }
  if (ratio >= 70) {
    return "bg-amber-500"
  }
  return "bg-red-500"
}

export function SalaryRow({
  teacher,
  periodSummary,
  onMarkPaid,
  onDetails,
  onHistory,
  dataTestIdPrefix,
}: SalaryRowProps) {
  const progressRatio =
    periodSummary.hoursPlanned > 0
      ? Math.max(0, Math.min(100, (periodSummary.hoursDone / periodSummary.hoursPlanned) * 100))
      : 0
  const status = statusMeta[periodSummary.status]
  const StatusIcon = status.icon
  const isPayable = periodSummary.canMarkPaid && (periodSummary.status === "pending" || periodSummary.isPartiallyPaid)

  return (
    <TableRow
      className={cn(
        "transition-[background-color,box-shadow] duration-150 ease-out-quint hover:bg-muted/30",
        isPayable ? "hover:shadow-sm" : "",
        periodSummary.status === "paid" ? "bg-muted/20 opacity-85" : ""
      )}
      data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-row-${teacher.id}` : undefined}
    >
      <TableCell className="min-w-[220px] py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border/60">
            <AvatarFallback
              className="text-xs font-semibold text-slate-700 dark:text-slate-700"
              style={{ backgroundColor: getAvatarColor(teacher.name) }}
            >
              {getInitials(teacher.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{teacher.name}</p>
            <Badge variant="outline" className={cn("mt-1 text-[11px] font-medium", teacherTypeMeta[teacher.type].className)}>
              {teacherTypeMeta[teacher.type].label}
            </Badge>
          </div>
        </div>
      </TableCell>

      <TableCell className="min-w-[220px] py-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{`${periodSummary.hoursDone}h / ${periodSummary.hoursPlanned}h`}</span>
            <span className="tabular-nums">{Math.round(progressRatio)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn("h-2 rounded-full transition-[width,background-color] duration-300 ease-out-expo", getProgressColor(progressRatio))}
              style={{ width: `${progressRatio}%` }}
            />
          </div>
        </div>
      </TableCell>

      <TableCell className="min-w-[140px] py-3">
        <p className="text-sm font-semibold tabular-nums">{formatFcfa(periodSummary.amountFcfa)}</p>
      </TableCell>

      <TableCell className="py-3">
        <Badge
          variant="outline"
          className={cn(
            "gap-1 text-xs font-medium",
            periodSummary.statusClassName ?? status.className
          )}
          data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-status-${teacher.id}` : undefined}
        >
          <StatusIcon className="h-3 w-3" />
          {periodSummary.statusLabel ?? status.label}
        </Badge>
      </TableCell>

      <TableCell className="min-w-[200px] py-3">
        <div className="flex flex-wrap justify-end gap-2">
          {periodSummary.status === "pending" && periodSummary.canMarkPaid ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onMarkPaid(teacher.id)}
              data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-mark-paid-${teacher.id}` : undefined}
            >
              <WalletCards className="h-3.5 w-3.5" />
              Valider paiement
            </Button>
          ) : null}
          {periodSummary.status === "paid" && periodSummary.isPartiallyPaid && periodSummary.canMarkPaid ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onMarkPaid(teacher.id)}
              data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-mark-paid-${teacher.id}` : undefined}
            >
              <WalletCards className="h-3.5 w-3.5" />
              Compléter paiement
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDetails(teacher.id)}
            data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-export-${teacher.id}` : undefined}
          >
            <FileText className="h-3.5 w-3.5" />
            Dossier
          </Button>
          {onHistory ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onHistory(teacher.id)}
              data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-history-${teacher.id}` : undefined}
            >
              <History className="h-3.5 w-3.5" />
              Historique
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}
