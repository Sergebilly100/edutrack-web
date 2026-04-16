import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type SalaryStatus = "pending" | "paid" | "disputed"

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
}

export interface SalaryRowProps {
  teacher: SalaryRowTeacher
  periodSummary: SalaryRowPeriodSummary
  onMarkPaid: (teacherId: string) => void
  onExportPDF: (teacherId: string) => void
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

const statusMeta: Record<SalaryStatus, { label: string; className: string }> = {
  pending: {
    label: "En attente",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200",
  },
  paid: {
    label: "Payé",
    className: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200",
  },
  disputed: {
    label: "Litige",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
  },
}

const getInitials = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) {
    return "?"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

const getAvatarColor = (name: string) => {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0
  }

  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 85% 92%)`
}

const formatFcfa = (amount: number) => `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`

const getProgressColor = (ratio: number) => {
  if (ratio >= 90) {
    return "bg-green-500"
  }
  if (ratio >= 70) {
    return "bg-amber-500"
  }
  return "bg-red-500"
}

export function SalaryRow({ teacher, periodSummary, onMarkPaid, onExportPDF, dataTestIdPrefix }: SalaryRowProps) {
  const progressRatio =
    periodSummary.hoursPlanned > 0
      ? Math.max(0, Math.min(100, (periodSummary.hoursDone / periodSummary.hoursPlanned) * 100))
      : 0

  return (
    <TableRow
      className={cn(periodSummary.status === "paid" ? "bg-muted/30 opacity-80" : "")}
      data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-row-${teacher.id}` : undefined}
    >
      <TableCell className="min-w-[220px]">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border/60">
            <AvatarFallback
              className="text-xs font-semibold text-slate-700 dark:text-slate-100"
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

      <TableCell className="min-w-[220px]">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{`${periodSummary.hoursDone}h / ${periodSummary.hoursPlanned}h`}</span>
            <span className="tabular-nums">{Math.round(progressRatio)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn("h-2 rounded-full transition-all", getProgressColor(progressRatio))}
              style={{ width: `${progressRatio}%` }}
            />
          </div>
        </div>
      </TableCell>

      <TableCell className="min-w-[140px]">
        <p className="text-sm font-semibold tabular-nums">{formatFcfa(periodSummary.amountFcfa)}</p>
      </TableCell>

      <TableCell>
        <Badge
          variant="outline"
          className={cn("text-xs font-medium", statusMeta[periodSummary.status].className)}
          data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-status-${teacher.id}` : undefined}
        >
          {statusMeta[periodSummary.status].label}
        </Badge>
      </TableCell>

      <TableCell className="min-w-[200px]">
        <div className="flex flex-wrap justify-end gap-2">
          {periodSummary.status === "pending" && periodSummary.canMarkPaid ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onMarkPaid(teacher.id)}
              data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-mark-paid-${teacher.id}` : undefined}
            >
              Marquer payé
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onExportPDF(teacher.id)}
            data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-export-${teacher.id}` : undefined}
          >
            Export PDF
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
