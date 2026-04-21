import { Link, useLocation } from "react-router-dom"

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
import { EmptyState } from "@/shared/components"

import { useTeacherStats } from "@/modules/teachers/hooks/useTeacherStats"

const formatHours = (value: number) => `${value.toFixed(2)}h`
const escapeCsvCell = (value: string | number) => {
  const raw = String(value ?? "")
  if (raw.includes('"') || raw.includes(",") || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export default function TeacherAnalysisPanel() {
  const {
    queryEnabled,
    formValues,
    setFormValues,
    filters,
    classesQuery,
    teachersQuery,
    subjectsOptions,
    statsQuery,
    handleApply,
    handleReset,
  } = useTeacherStats()
  const location = useLocation()

  const handleExportCsv = () => {
    const headers = [
      "Professeur",
      "Type",
      "Taux présence",
      "Présences",
      "Heures effectuées",
      "Heures prévues",
      "Retards",
      "Mismatch salle",
      "Pointage élèves manquant",
    ]
    const rows = (statsQuery.data ?? []).map((row) =>
      [
        row.teacher_name,
        row.teacher_type,
        `${row.attendance_rate}%`,
        `${row.present_count}/${row.total_scheduled}`,
        `${row.hours_done}h`,
        `${row.hours_scheduled}h`,
        row.late_count,
        row.room_mismatch_count,
        row.rollcall_missing_count,
      ]
        .map((cell) => escapeCsvCell(cell))
        .join(",")
    )
    const csv = [headers.map((cell) => escapeCsvCell(cell)).join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `presence-profs-${filters.from}-${filters.to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

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
            <div className="min-w-[200px] space-y-2">
              <p className="text-sm font-medium">Statut</p>
              <Select
                value={formValues.status_filter}
                onValueChange={(value: typeof formValues.status_filter) =>
                  setFormValues((current) => ({ ...current, status_filter: value }))
                }
              >
                <SelectTrigger className="min-h-12">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="absent">Absences</SelectItem>
                  <SelectItem value="room_mismatch">Mismatch salle</SelectItem>
                  <SelectItem value="rollcall_missing">Pointage manquant</SelectItem>
                  <SelectItem value="late">Retards</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px] space-y-2">
              <p className="text-sm font-medium">Professeur</p>
              <Select
                value={formValues.teacher_id}
                onValueChange={(value) =>
                  setFormValues((current) => ({ ...current, teacher_id: value }))
                }
              >
                <SelectTrigger className="min-h-12">
                  <SelectValue placeholder="Tous les professeurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les professeurs</SelectItem>
                  {(teachersQuery.data ?? []).map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px] space-y-2">
              <p className="text-sm font-medium">Matière</p>
              <Select
                value={formValues.subject}
                onValueChange={(value) =>
                  setFormValues((current) => ({ ...current, subject: value }))
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
          <AlertDescription>Impossible de charger les statistiques de présence.</AlertDescription>
        </Alert>
      ) : null}

      {queryEnabled ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            {Array.isArray(statsQuery.data) && statsQuery.data.length > 0 ? (
              <div className="flex justify-end">
                <Button className="min-h-12" variant="outline" onClick={handleExportCsv}>
                  Export CSV
                </Button>
              </div>
            ) : null}

            {statsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={`teacher-stats-skeleton-${index}`} className="h-12 w-full" />
                ))}
              </div>
            ) : null}

            {!statsQuery.isLoading && (statsQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="Aucune donnée sur cette période"
                message="Ajustez les filtres ou élargissez la période pour afficher des résultats."
              />
            ) : null}

            {!statsQuery.isLoading && (statsQuery.data?.length ?? 0) > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Professeur</TableHead>
                    <TableHead>Taux présence</TableHead>
                    <TableHead>Présences</TableHead>
                    <TableHead>Heures</TableHead>
                    <TableHead>Retards</TableHead>
                    <TableHead>Salle incorrecte</TableHead>
                    <TableHead>Pointage élèves</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statsQuery.data?.map((row) => {
                    const rate = Math.max(0, Math.min(100, row.attendance_rate))
                    const rateColorClass =
                      rate >= 80
                        ? "[&>div]:bg-green-500"
                        : rate >= 50
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-red-500"
                    const doneOrMissing = row.rollcall_missing_count > 0

                    return (
                      <TableRow key={row.teacher_id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{row.teacher_name}</p>
                            <Badge
                              variant="outline"
                              className={cn(
                                row.teacher_type === "vacataire"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700"
                              )}
                            >
                              {row.teacher_type}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={rate} className={cn("w-24", rateColorClass)} />
                            <p className="text-xs text-muted-foreground">{rate.toFixed(2)}%</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.present_count} / {row.total_scheduled}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{formatHours(row.hours_done)} effectuées</p>
                            <p className="text-xs text-muted-foreground">
                              / {formatHours(row.hours_scheduled)} prévues
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.late_count > 0 ? (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                              {row.late_count}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {row.room_mismatch_count > 0 ? (
                            <Badge variant="destructive">{row.room_mismatch_count}</Badge>
                          ) : (
                            <Badge className="border-green-200 bg-green-50 text-green-700">OK</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {doneOrMissing ? (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                              Manquant {row.rollcall_missing_count}
                            </Badge>
                          ) : (
                            <Badge className="border-green-200 bg-green-50 text-green-700">
                              Fait {row.rollcall_done_count}/{row.total_scheduled}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button asChild size="sm" variant="outline" className="min-h-12">
                            <Link
                              to={`/teachers/${row.teacher_id}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
                            >
                              Voir
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
