import { useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AlertTriangle, Eye, MessageCircle, Phone, UserRound } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import StudentAbsenceDetail from "@/modules/students/components/StudentAbsenceDetail"
import { type StudentAbsenceStat } from "@/modules/students/students.api"
import { useStudentAbsences } from "@/modules/students/hooks/useStudentAbsences"
import { EmptyState } from "@/shared/components"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"

const smsConfig: Record<
  "all_sent" | "partial" | "none",
  { label: string; className: string }
> = {
  all_sent: {
    label: "Notifié",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  partial: {
    label: "Partiel",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  none: {
    label: "Non notifié",
    className: "bg-red-100 text-red-700 border-red-200",
  },
}

const escapeCsvCell = (value: string | number) => {
  const raw = String(value ?? "")
  if (raw.includes('"') || raw.includes(",") || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

const formatRate = (value: number | null | undefined) => `${(value ?? 0).toFixed(2)}%`

const formatPhone = (value: string | null) => (value ? `+${value}` : "—")

export default function StudentAbsencePanel() {
  const {
    queryEnabled,
    formValues,
    setFormValues,
    filters,
    classesQuery,
    subjectsOptions,
    statsQuery,
    handleApply,
    handleReset,
  } = useStudentAbsences()
  const navigate = useNavigate()
  const location = useLocation()
  const studentLabels = useStudentLabels()

  const [selectedStudent, setSelectedStudent] = useState<StudentAbsenceStat | null>(null)

  const hasRows = (statsQuery.data?.length ?? 0) > 0

  const handleExportCsv = () => {
    const rows = statsQuery.data ?? []
    const headers = [
      studentLabels.singular,
      "Classe",
      "Nb absences",
      "Taux",
      "Téléphone 1",
      "Téléphone 2",
      "État SMS",
    ]

    const csvRows = rows.map((row) =>
      [
        row.studentName,
        row.className,
        row.absenceCount,
        `${row.absenceRate ?? 0}%`,
        row.parentPhone ?? "",
        row.parentPhone2 ?? "",
        smsConfig[row.smsSummary].label,
      ]
        .map((cell) => escapeCsvCell(cell))
        .join(",")
    )

    const csv = [headers.map((cell) => escapeCsvCell(cell)).join(","), ...csvRows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `absences-eleves-${filters.from}-${filters.to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const detailSubject = useMemo(() => filters.subject, [filters.subject])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] space-y-2">
              <p className="text-sm font-medium">Du</p>
              <Input
                type="date"
                className="min-h-12"
                value={formValues.from}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, from: event.target.value }))
                }
              />
            </div>
            <div className="min-w-[180px] space-y-2">
              <p className="text-sm font-medium">Au</p>
              <Input
                type="date"
                className="min-h-12"
                value={formValues.to}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, to: event.target.value }))
                }
              />
            </div>
            <div className="min-w-[220px] space-y-2">
              <p className="text-sm font-medium">Classe</p>
              <Select
                value={formValues.class_id}
                onValueChange={(value) =>
                  setFormValues((current) => ({ ...current, class_id: value }))
                }
              >
                <SelectTrigger className="min-h-12">
                  <SelectValue placeholder="Toutes les classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {(classesQuery.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px] space-y-2">
              <p className="text-sm font-medium">Matière</p>
              <Select
                value={formValues.subject || "all"}
                onValueChange={(value) =>
                  setFormValues((current) => ({ ...current, subject: value === "all" ? "" : value }))
                }
              >
                <SelectTrigger className="min-h-12">
                  <SelectValue placeholder="Toutes les matières" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les matières</SelectItem>
                  {subjectsOptions.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px] space-y-2">
              <p className="text-sm font-medium">État SMS</p>
              <Select
                value={formValues.sms_status}
                onValueChange={(value: "all" | "sent" | "not_sent" | "failed") =>
                  setFormValues((current) => ({ ...current, sms_status: value }))
                }
              >
                <SelectTrigger className="min-h-12">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="sent">Notifié</SelectItem>
                  <SelectItem value="not_sent">Non notifié</SelectItem>
                  <SelectItem value="failed">Échec</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px] space-y-2">
              <p className="text-sm font-medium">Absences minimum</p>
              <Input
                type="number"
                min={1}
                className="min-h-12"
                value={formValues.min_absences}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    min_absences: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />
            </div>
            <Button className="min-h-12" size="lg" onClick={handleApply}>
              Analyser
            </Button>
            <Button className="min-h-12" variant="outline" onClick={handleReset}>
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {statsQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les statistiques d&apos;absences.</AlertDescription>
        </Alert>
      ) : null}

      {queryEnabled ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            {hasRows ? (
              <div className="flex justify-end">
                <Button className="min-h-12" variant="outline" onClick={handleExportCsv}>
                  Export CSV
                </Button>
              </div>
            ) : null}

            {statsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={`absence-stats-skeleton-${index}`} className="h-12 w-full" />
                ))}
              </div>
            ) : null}

            {!statsQuery.isLoading && !hasRows ? (
              <EmptyState
                title="Aucune absence sur cette période"
                message="Ajustez les filtres ou élargissez la période pour afficher des résultats."
              />
            ) : null}

            {!statsQuery.isLoading && hasRows ? (
              <>
              <div className="space-y-3 lg:hidden">
                {statsQuery.data?.map((row) => {
                  const rate = Math.max(0, Math.min(100, row.absenceRate ?? 0))
                  const rateColorClass =
                    rate > 20
                      ? "[&>div]:bg-red-500"
                      : rate > 10
                        ? "[&>div]:bg-amber-500"
                        : "[&>div]:bg-green-500"
                  const rateTone =
                    rate > 20
                      ? "border-red-200 bg-red-50 text-red-700"
                      : rate > 10
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-green-200 bg-green-50 text-green-700"

                  return (
                    <article key={row.studentId} className="rounded-xl border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <UserRound className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold">{row.studentName}</h3>
                            <p className="text-xs text-muted-foreground">{row.className}</p>
                          </div>
                        </div>
                        <Badge variant="outline" role="status" aria-label={`${row.absenceCount} absences`} className="gap-1 border-red-200 bg-red-50 text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {row.absenceCount} abs.
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">Taux d'absence</p>
                          <Badge variant="outline" role="status" aria-label={`Taux d'absence ${formatRate(row.absenceRate)}`} className={cn("gap-1", rateTone)}>
                            {formatRate(row.absenceRate)}
                          </Badge>
                        </div>
                        <Progress value={rate} className={cn("h-2", rateColorClass)} aria-label={`Taux d'absence ${formatRate(row.absenceRate)}`} />
                        <p className="text-xs text-muted-foreground">
                          {row.absenceCount} absence(s) sur {row.totalScheduled} cours planifiés.
                        </p>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <span className="inline-flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> Parent</span>
                          <span className="font-medium">{formatPhone(row.parentPhone)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <span className="inline-flex items-center gap-2 text-muted-foreground"><MessageCircle className="h-4 w-4" /> Notification</span>
                          <Badge variant="outline" role="status" className={smsConfig[row.smsSummary].className}>
                            {smsConfig[row.smsSummary].label}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Button variant="outline" onClick={() => setSelectedStudent(row)}>
                          <Eye className="h-4 w-4" />
                          Détail
                        </Button>
                        <Button
                          onClick={() =>
                            navigate(
                              `/students/${row.studentId}?returnTo=${encodeURIComponent(
                                `${location.pathname}${location.search}`
                              )}`
                            )
                          }
                        >
                          Ouvrir la fiche
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{studentLabels.singular}</TableHead>
                      <TableHead>Absences</TableHead>
                      <TableHead>Taux d&apos;absence</TableHead>
                      <TableHead>Contact parent</TableHead>
                      <TableHead>État SMS</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statsQuery.data?.map((row) => {
                      const rate = Math.max(0, Math.min(100, row.absenceRate ?? 0))
                      const rateColorClass =
                        rate > 20
                          ? "[&>div]:bg-red-500"
                          : rate > 10
                            ? "[&>div]:bg-amber-500"
                            : "[&>div]:bg-green-500"

                      return (
                        <TableRow key={row.studentId}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{row.studentName}</p>
                              <p className="text-xs text-muted-foreground">{row.className}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="border-red-200 bg-red-100 text-red-700">
                              {row.absenceCount}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={rate} className={cn("w-28", rateColorClass)} />
                              <p className="text-xs text-muted-foreground">
                                {formatRate(row.absenceRate)} ({row.absenceCount}/{row.totalScheduled})
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs">
                              <p>{formatPhone(row.parentPhone)}</p>
                              {row.parentPhone2 ? (
                                <p className="text-muted-foreground">{formatPhone(row.parentPhone2)}</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={smsConfig[row.smsSummary].className}>
                              {smsConfig[row.smsSummary].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-h-12"
                                onClick={() => setSelectedStudent(row)}
                              >
                                Voir détail
                              </Button>
                              <Button
                                size="sm"
                                className="min-h-12"
                                onClick={() =>
                                  navigate(
                                    `/students/${row.studentId}?returnTo=${encodeURIComponent(
                                      `${location.pathname}${location.search}`
                                    )}`
                                  )
                                }
                              >
                                Voir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <StudentAbsenceDetail
        open={Boolean(selectedStudent)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudent(null)
          }
        }}
        student={selectedStudent}
        from={filters.from}
        to={filters.to}
        subject={detailSubject}
      />
    </div>
  )
}
