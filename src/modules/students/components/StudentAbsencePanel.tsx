import { useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

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

const formatRate = (value: number) => `${value.toFixed(2)}%`

const formatPhone = (value: string | null) => (value ? `📱 +${value}` : "—")

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

  const [selectedStudent, setSelectedStudent] = useState<StudentAbsenceStat | null>(null)

  const hasRows = (statsQuery.data?.length ?? 0) > 0

  const handleExportCsv = () => {
    const rows = statsQuery.data ?? []
    const headers = [
      "Élève",
      "Classe",
      "Nb absences",
      "Taux",
      "Téléphone 1",
      "Téléphone 2",
      "État SMS",
    ]

    const csvRows = rows.map((row) =>
      [
        row.student_name,
        row.class_name,
        row.absence_count,
        `${row.absence_rate}%`,
        row.parent_phone ?? "",
        row.parent_phone_2 ?? "",
        smsConfig[row.sms_summary].label,
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élève</TableHead>
                      <TableHead>Absences</TableHead>
                      <TableHead>Taux d&apos;absence</TableHead>
                      <TableHead>Contact parent</TableHead>
                      <TableHead>État SMS</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statsQuery.data?.map((row) => {
                      const rate = Math.max(0, Math.min(100, row.absence_rate))
                      const rateColorClass =
                        rate > 20
                          ? "[&>div]:bg-red-500"
                          : rate > 10
                            ? "[&>div]:bg-amber-500"
                            : "[&>div]:bg-green-500"

                      return (
                        <TableRow key={row.student_id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{row.student_name}</p>
                              <p className="text-xs text-muted-foreground">{row.class_name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="border-red-200 bg-red-100 text-red-700">
                              {row.absence_count}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={rate} className={cn("w-28", rateColorClass)} />
                              <p className="text-xs text-muted-foreground">
                                {formatRate(row.absence_rate)} ({row.absence_count}/{row.total_scheduled})
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs">
                              <p>{formatPhone(row.parent_phone)}</p>
                              {row.parent_phone_2 ? (
                                <p className="text-muted-foreground">{formatPhone(row.parent_phone_2)}</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={smsConfig[row.sms_summary].className}>
                              {smsConfig[row.sms_summary].label}
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
                                    `/students/${row.student_id}?returnTo=${encodeURIComponent(
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
