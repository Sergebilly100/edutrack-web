import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { SalarySummaryItem, SalaryTeacherDetails } from "@/modules/salaries/salaries.api"
import {
  countCourses,
  formatCourseDate,
  formatHoursCount,
  formatSalaryDescriptor,
  formatTimeRange,
  getSalaryStatusTone,
  matchesCourseFilter,
  pluralize,
  toDisplayedStatus,
  type CourseFilter,
} from "@/modules/salaries/salaries.helpers"
import { DetailDialog } from "@/shared/components/DetailDialog"
import { EmptyState } from "@/shared/components/EmptyState"
import { KeyFigure } from "@/shared/components/KeyFigure"
import { LabelValueList, type LabelValueRow } from "@/shared/components/LabelValueList"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { StatusPill, type StatusTone } from "@/shared/components/StatusPill"
import { formatFcfa } from "@/shared/utils/formatting"

const VISIBLE_COURSES = 5

const FILTERS: ReadonlyArray<{ id: CourseFilter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "absent", label: "Absents" },
  { id: "done", label: "Effectués" },
  { id: "upcoming", label: "À venir" },
]

const attendancePill: Record<SalaryTeacherDetails["rows"][number]["attendanceStatus"], { label: string; tone: StatusTone }> = {
  present: { label: "Présent", tone: "success" },
  late: { label: "En retard", tone: "warning" },
  absent: { label: "Absent", tone: "danger" },
  not_marked: { label: "À venir", tone: "neutral" },
}

export type SalaryDetailsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: SalarySummaryItem | null
  details: SalaryTeacherDetails | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  /** « novembre 2026 » */
  monthLabel: string
  canMarkPaid: boolean
  canExport: boolean
  isExporting: boolean
  onExport: () => void
  onValidatePayment: () => void
}

export function SalaryDetailsDialog({ open, onOpenChange, row, details, isLoading, isError, onRetry, monthLabel, canMarkPaid, canExport, isExporting, onExport, onValidatePayment }: SalaryDetailsDialogProps) {
  const [filter, setFilter] = useState<CourseFilter>("all")
  const [expanded, setExpanded] = useState(false)

  const summary = details?.summary
  const remainingToPay = summary?.amountRemainingToPayNow ?? 0
  const alreadySettled = row?.status === "paid" && !row.isPartiallyPaid
  const isPermanent = row?.teacherType === "permanent"
  // Permanent : montant fixe, pas de reste en heures → on suit la même condition que le bouton « Marquer payé » de la liste.
  const hasAmountToPay = isPermanent
    ? row?.status === "pending" || Boolean(row?.status === "paid" && row.isPartiallyPaid)
    : remainingToPay > 0 && !alreadySettled && row?.status !== "nothing_to_pay"
  const canValidate = canMarkPaid && hasAmountToPay
  const footerMessage = !canMarkPaid
    ? "Vous n'avez pas la permission de valider un paiement."
    : alreadySettled
      ? "Cette période est déjà payée."
      : !hasAmountToPay
        ? "Rien à payer pour cette période."
        : null

  const courses = details?.rows ?? []
  const counts = countCourses(courses)
  const filtered = courses.filter((course) => matchesCourseFilter(course, filter))
  const visible = expanded ? filtered : filtered.slice(0, VISIBLE_COURSES)
  const hiddenCount = filtered.length - visible.length

  const absenceHours = summary?.absenceHours ?? 0
  const absenceAmount = summary?.absenceAmount ?? 0
  const lastPayment = details?.payment
  const presenceRate = summary && summary.hoursPlanned > 0 ? Math.round((summary.hoursDone / summary.hoursPlanned) * 100) : 0
  const permanentBreakdown: LabelValueRow[] = summary && details
    ? [
        { key: "fixed", label: "Montant fixe mensuel", value: details.teacher.monthlySalary !== null ? formatFcfa(details.teacher.monthlySalary) : "Non renseigné", strong: true },
        { key: "remaining-hours", label: "Heures restantes prévues", value: formatHoursCount(summary.remainingPlannedHours), separated: true },
        { key: "presence", label: "Taux de présence du mois", value: `${presenceRate} %`, separated: true },
        {
          key: "last-payment",
          label: "Dernier paiement",
          value: lastPayment?.paidAt
            ? `${new Date(lastPayment.paidAt).toLocaleString("fr-FR")}${lastPayment.paidByName ? ` · par ${lastPayment.paidByName}${lastPayment.paidByRole ? ` (${lastPayment.paidByRole})` : ""}` : ""}${lastPayment.notes ? ` · note : ${lastPayment.notes}` : ""}`
            : "Aucun paiement enregistré sur la période.",
          tone: "muted",
          separated: true,
        },
      ]
    : []
  const breakdown: LabelValueRow[] = summary && !isPermanent
    ? [
        { key: "earned", label: "Salaire acquis (heures effectuées)", value: formatFcfa(summary.currentEarnedAmount ?? 0) },
        {
          key: "deduction",
          label: "Retenue pour absences non validées",
          value: absenceAmount > 0 ? `− ${formatFcfa(absenceAmount)}` : formatFcfa(0),
          tone: absenceAmount > 0 ? "danger" : "default",
        },
        { key: "paid", label: "Déjà payé", value: formatFcfa(summary.amountAlreadyPaid ?? 0) },
        { key: "remaining", label: "Reste à payer", value: formatFcfa(remainingToPay), strong: true, separated: true },
        {
          key: "estimate",
          label: (
            <span className="flex flex-wrap items-center gap-2 font-normal">
              Sur les {formatHoursCount(summary.remainingPlannedHours)} restantes
              <StatusPill tone="info">Estimation</StatusPill>
            </span>
          ),
          value: formatFcfa(summary.remainingPotentialAmount ?? 0),
          tone: "muted",
        },
      ]
    : []

  return (
    <DetailDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={row?.teacherName ?? "Détails salaire professeur"}
      initialsOf={row?.teacherName}
      subtitle={row ? `${isPermanent ? "Permanent" : "Vacataire"} · ${monthLabel} · ${formatSalaryDescriptor(row, details)}` : "Détails salaire professeur"}
      badges={row ? <StatusPill tone={getSalaryStatusTone(row, details)}>{toDisplayedStatus(row, details)}</StatusPill> : null}
      footer={
        <>
          <p className="text-sm text-muted-foreground" id="salary-details-footer-message">{footerMessage}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
            {canExport ? (
              <Button type="button" variant="outline" disabled={isExporting || !details} onClick={onExport}>
                {isExporting ? "Préparation…" : "Exporter la fiche"}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={!canValidate}
              aria-describedby={footerMessage ? "salary-details-footer-message" : undefined}
              onClick={onValidatePayment}
            >
              Valider un paiement
            </Button>
          </div>
        </>
      }
    >
      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Chargement des détails du salaire">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : isError || !details || !summary ? (
        <QueryErrorState message="Impossible de charger les détails du salaire." onRetry={onRetry} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KeyFigure label="Heures prévues" value={formatHoursCount(summary.hoursPlanned)} />
            <KeyFigure label="Heures effectuées" value={formatHoursCount(summary.hoursDone)} />
            <KeyFigure label={isPermanent ? "Heures manquées" : "Absences non validées"} value={formatHoursCount(absenceHours)} tone={absenceHours > 0 ? "danger" : "default"} />
          </div>

          <LabelValueList rows={isPermanent ? permanentBreakdown : breakdown} />

          <section aria-labelledby="salary-courses-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="salary-courses-title" className="text-base font-semibold">Cours du mois</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les cours">
                {FILTERS.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-pressed={filter === item.id}
                    className={cn("min-h-10 rounded-full", filter === item.id && "border-primary bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200")}
                    onClick={() => { setFilter(item.id); setExpanded(false) }}
                  >
                    {item.label} · {counts[item.id]}
                  </Button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="Aucun cours" message="Aucun cours ne correspond à ce filtre pour ce mois." />
            ) : (
              <>
                <div className="hidden rounded-lg border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4">Date</TableHead>
                        <TableHead>Cours</TableHead>
                        <TableHead>Horaire</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((course, index) => (
                        <TableRow key={`${course.date}-${course.startTime}-${course.className}-${index}`}>
                          <TableCell className="px-4 py-3">{formatCourseDate(course.date)}</TableCell>
                          <TableCell className="py-3">{course.subject} · {course.className}</TableCell>
                          <TableCell className="py-3 tabular-nums">{formatTimeRange(course.startTime, course.endTime)}</TableCell>
                          <TableCell className="py-3"><StatusPill tone={attendancePill[course.attendanceStatus].tone}>{attendancePill[course.attendanceStatus].label}</StatusPill></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="space-y-2 md:hidden">
                  {visible.map((course, index) => (
                    <li key={`${course.date}-${course.startTime}-${course.className}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{course.subject} · {course.className}</p>
                        <p className="text-muted-foreground">{formatCourseDate(course.date)} · {formatTimeRange(course.startTime, course.endTime)}</p>
                      </div>
                      <StatusPill tone={attendancePill[course.attendanceStatus].tone}>{attendancePill[course.attendanceStatus].label}</StatusPill>
                    </li>
                  ))}
                </ul>
                {hiddenCount > 0 ? (
                  <Button type="button" variant="link" className="h-auto min-h-10 p-0" onClick={() => setExpanded(true)}>
                    {hiddenCount === 1 ? "Afficher l'autre cours" : `Afficher les ${hiddenCount} ${pluralize(hiddenCount, "autre cours", "autres cours")}`}
                  </Button>
                ) : expanded && filtered.length > VISIBLE_COURSES ? (
                  <Button type="button" variant="link" className="h-auto min-h-10 p-0" onClick={() => setExpanded(false)}>
                    Réduire la liste
                  </Button>
                ) : null}
              </>
            )}
          </section>
        </>
      )}
    </DetailDialog>
  )
}
