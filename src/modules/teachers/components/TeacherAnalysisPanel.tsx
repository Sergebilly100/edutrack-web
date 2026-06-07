import { Link, useLocation } from "react-router-dom"
import { AlertTriangle, CheckCircle2, Clock3, DoorOpen, ListChecks } from "lucide-react"

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
import { exportTeacherAttendanceStats } from "@/modules/teachers/teachers.api"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { usePdfExportJob } from "@/shared/hooks/usePdfExportJob"
import { formatDecimalHours } from "@/shared/utils/time"

const formatHours = (value: number) => formatDecimalHours(value)

export default function TeacherAnalysisPanel() {
  const {
    queryEnabled,
    formValues,
    setFormValues,
    filters,
    classOptions,
    teachersQuery,
    subjectsOptions,
    statsQuery,
    handleApply,
    handleReset,
  } = useTeacherStats()
  const location = useLocation()
  const studentLabels = useStudentLabels()

  const attendanceExport = usePdfExportJob({
    fallbackFileName: `presence-profs-${filters.from}-${filters.to}.pdf`,
    startedMessage: "Le bilan de présence (PDF) est en cours de génération.",
    successMessage: "Bilan de présence téléchargé",
    errorMessage: "Impossible d'exporter le bilan de présence.",
  })

  const handleExportPdf = () =>
    attendanceExport.launch(() =>
      exportTeacherAttendanceStats({
        from: filters.from,
        to: filters.to,
        subject: filters.subject,
        class_id: filters.class_id,
        teacher_id: filters.teacher_id,
        status_filter: filters.status_filter,
      })
    )

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
                  <SelectItem value="room_mismatch">Salle incorrecte</SelectItem>
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
                  setFormValues((current) => ({
                    ...current,
                    teacher_id: value,
                    ...(value === "all"
                      ? {
                          subject: "all",
                          class_id: "all",
                        }
                      : {}),
                  }))
                }
              >
                <SelectTrigger className="min-h-12">
                  <SelectValue placeholder="Tous les professeurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les professeurs</SelectItem>
                  {(teachersQuery.data ?? []).map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.matricule ? `${teacher.name} (${teacher.matricule})` : teacher.name}
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
                  {classOptions.map((item) => (
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
                <Button
                  className="min-h-12"
                  variant="outline"
                  onClick={handleExportPdf}
                  disabled={attendanceExport.isRunning}
                >
                  {attendanceExport.isRunning ? "Génération du PDF..." : "Export PDF"}
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
              <>
                <div className="space-y-3 lg:hidden">
                  {statsQuery.data?.map((row) => {
                    const rate = Math.max(0, Math.min(100, row.attendance_rate))
                    const rateTone =
                      rate >= 80
                        ? "border-green-200 bg-green-50 text-green-700"
                        : rate >= 50
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-red-200 bg-red-50 text-red-700"
                    const rateColorClass =
                      rate >= 80
                        ? "[&>div]:bg-green-500"
                        : rate >= 50
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-red-500"
                    const doneOrMissing = row.rollcall_missing_count > 0

                    return (
                      <article key={row.teacher_id} className="rounded-xl border bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold">{row.teacher_name}</h3>
                            {row.teacher_matricule ? (
                              <p className="text-xs text-muted-foreground">Matricule : {row.teacher_matricule}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">{row.teacher_type}</p>
                          </div>
                          <Badge variant="outline" role="status" aria-label={`Taux de présence ${rate.toFixed(0)} pour cent`} className={cn("gap-1", rateTone)}>
                            {rate >= 80 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                            {rate.toFixed(0)}%
                          </Badge>
                        </div>

                        <div className="mt-4 space-y-2">
                          <Progress value={rate} className={cn("h-2", rateColorClass)} aria-label={`Taux de présence ${rate.toFixed(2)} pour cent`} />
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-lg bg-muted/50 p-3">
                              <p className="text-xs text-muted-foreground">Présences</p>
                              <p className="font-semibold">{row.present_count}/{row.total_scheduled}</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                              <p className="text-xs text-muted-foreground">Heures</p>
                              <p className="font-semibold">{formatHours(row.hours_done)}</p>
                              <p className="text-xs text-muted-foreground">sur {formatHours(row.hours_scheduled)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm">
                          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                            <span className="inline-flex items-center gap-2 text-muted-foreground"><Clock3 className="h-4 w-4" /> Retards</span>
                            <span className="font-medium">{row.late_count}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                            <span className="inline-flex items-center gap-2 text-muted-foreground"><DoorOpen className="h-4 w-4" /> Salle incorrecte</span>
                            <Badge variant="outline" role="status" className={row.room_mismatch_count > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}>
                              {row.room_mismatch_count > 0 ? `${row.room_mismatch_count} anomalie(s)` : "OK"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                            <span className="inline-flex items-center gap-2 text-muted-foreground"><ListChecks className="h-4 w-4" /> {`Pointage ${studentLabels.pluralLower}`}</span>
                            <Badge variant="outline" role="status" className={doneOrMissing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-700"}>
                              {doneOrMissing ? `Manquant ${row.rollcall_missing_count}` : `Fait ${row.rollcall_done_count}/${row.total_scheduled}`}
                            </Badge>
                          </div>
                        </div>

                        <Button asChild variant="outline" className="mt-4 w-full">
                          <Link to={`/teachers/${row.teacher_id}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>
                            Ouvrir la fiche
                          </Link>
                        </Button>
                      </article>
                    )
                  })}
                </div>

                <div className="hidden overflow-x-auto rounded-lg border lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Professeur</TableHead>
                        <TableHead>Taux présence</TableHead>
                        <TableHead>Présences</TableHead>
                        <TableHead>Heures</TableHead>
                        <TableHead>Retards</TableHead>
                        <TableHead>Salle incorrecte</TableHead>
                        <TableHead>{`Pointage ${studentLabels.pluralLower}`}</TableHead>
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
                                {row.teacher_matricule ? (
                                  <p className="text-xs text-muted-foreground">Matricule : {row.teacher_matricule}</p>
                                ) : null}
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    row.teacher_type === "vacataire"
                                      ? "border-amber-200 bg-amber-50 text-amber-900"
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
                                <Badge className="border-amber-200 bg-amber-50 text-amber-900">
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
                                <Badge className="border-amber-200 bg-amber-50 text-amber-900">
                                  Manquant {row.rollcall_missing_count}
                                </Badge>
                              ) : (
                                <Badge className="border-green-200 bg-green-50 text-green-700">
                                  Fait {row.rollcall_done_count}/{row.total_scheduled}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button asChild size="sm" variant="outline">
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
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
