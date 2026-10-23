import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, ChevronDown, GraduationCap, X } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/shared/components/EmptyState"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "react-router-dom"
import { getParentGrades, listParentReportCards, listParentStudents } from "./parent.api"
import type { ParentGradeEvaluation } from "./parent.api"

const SELECTED_STUDENT_STORAGE_KEY = "parent_selected_student_id"

const formatAverage = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const formatNumber = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 })
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "UTC",
})

const formatEvaluationDate = (date: string | null): string =>
  date ? dateFormatter.format(new Date(`${date}T00:00:00.000Z`)) : "Date non renseignée"

const formatScore = (evaluation: ParentGradeEvaluation): string => {
  const sign = evaluation.type === "spontaneous" && evaluation.score > 0 ? "+" : ""
  return `${sign}${formatNumber.format(evaluation.score)} / ${formatNumber.format(evaluation.maxScore)}`
}

export default function ParentGradesPage() {
  const studentsQuery = useQuery({
    queryKey: ["parent", "students"],
    queryFn: listParentStudents,
  })
  const students = studentsQuery.data ?? []

  const [selectedStudentId, setSelectedStudentId] = useState(
    () => sessionStorage.getItem(SELECTED_STUDENT_STORAGE_KEY) ?? ""
  )
  const [selectedGradingPeriodId, setSelectedGradingPeriodId] = useState<string | null>(null)
  const [periods, setPeriods] = useState<Array<{ id: string; label: string }>>([])
  const [dismissedReportCardId, setDismissedReportCardId] = useState<string | null>(null)
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null)

  useEffect(() => {
    if (students.length === 0) {
      if (selectedStudentId) {
        setSelectedStudentId("")
        setSelectedGradingPeriodId(null)
        setPeriods([])
      }
      return
    }
    if (students.some((student) => student.id === selectedStudentId)) return

    const persistedStudentId = sessionStorage.getItem(SELECTED_STUDENT_STORAGE_KEY)
    const nextStudentId = students.find((student) => student.id === persistedStudentId)?.id
      ?? students[0]!.id
    setSelectedStudentId(nextStudentId)
    setSelectedGradingPeriodId(null)
    setPeriods([])
    sessionStorage.setItem(SELECTED_STUDENT_STORAGE_KEY, nextStudentId)
  }, [selectedStudentId, students])

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students]
  )

  const gradesQuery = useQuery({
    queryKey: ["parent", "grades", selectedStudentId, selectedGradingPeriodId],
    queryFn: () => getParentGrades(selectedStudentId, selectedGradingPeriodId ?? undefined),
    enabled: students.some((student) => student.id === selectedStudentId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  })

  const reportCardsQuery = useQuery({
    queryKey: ["parent", "report-cards", selectedStudentId, "years"],
    queryFn: () => listParentReportCards(selectedStudentId),
    enabled: students.some((student) => student.id === selectedStudentId),
    staleTime: 0,
    refetchInterval: 15000,
  })

  useEffect(() => {
    if (gradesQuery.data) setPeriods(gradesQuery.data.periods)
  }, [gradesQuery.data])

  const selectedPeriodId = selectedGradingPeriodId
    ?? gradesQuery.data?.selectedGradingPeriodId
    ?? ""
  const showingCurrentData = Boolean(
    gradesQuery.data &&
    gradesQuery.data.selectedGradingPeriodId === selectedPeriodId &&
    !gradesQuery.isFetching
  )
  const subjects = showingCurrentData ? gradesQuery.data?.subjects ?? [] : []
  const conductGrade = showingCurrentData ? gradesQuery.data?.conductGrade ?? null : null
  const resultsInRevision = showingCurrentData && (gradesQuery.data?.resultsInRevision ?? false)
  const latestPublishedReportCard = reportCardsQuery.data?.reportCards[0] ?? null
  const showReportCardAlert = latestPublishedReportCard !== null
    && latestPublishedReportCard.id !== dismissedReportCardId

  const selectStudent = (studentId: string) => {
    setSelectedStudentId(studentId)
    setSelectedGradingPeriodId(null)
    setPeriods([])
    setDismissedReportCardId(null)
    setOpenSubjectId(null)
    sessionStorage.setItem(SELECTED_STUDENT_STORAGE_KEY, studentId)
  }

  return (
    <div className="space-y-4 text-base sm:py-6">
      <OfflineIndicator />
      <header className="flex items-start gap-3 pb-2">
        {/* <GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" /> */}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Résultats validés pour l’année scolaire en cours.
          </p>
        </div>
      </header>

      {studentsQuery.isPending ? (
        <div role="status" aria-label="Chargement des enfants">
          <Skeleton className="h-12 w-full rounded-lg" />
          <span className="sr-only">Chargement des enfants…</span>
        </div>
      ) : studentsQuery.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Impossible de charger les enfants rattachés à votre compte.</span>
            <Button type="button" variant="outline" className="min-h-12" onClick={() => void studentsQuery.refetch()}>
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      ) : students.length === 0 ? (
        <EmptyState
          title="Aucun enfant rattaché"
          description="Contactez l’établissement pour accéder aux résultats."
        />
      ) : (
        <>
          {students.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="parent-grades-student">Enfant</Label>
              <Select value={selectedStudentId} onValueChange={selectStudent}>
                <SelectTrigger id="parent-grades-student" className="min-h-10 w-full">
                  <SelectValue placeholder="Choisir un enfant" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.last_name} {student.first_name} · {student.class_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : selectedStudent ? (
            <div className="flex min-h-10 items-center gap-3 rounded-lg border bg-card px-3 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {selectedStudent.last_name[0]}{selectedStudent.first_name[0]}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {selectedStudent.last_name} {selectedStudent.first_name}
                </span>
                <span className="block truncate text-sm text-muted-foreground">{selectedStudent.class_name}</span>
              </span>
            </div>
          ) : null}

          {periods.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="parent-grades-period">Période</Label>
              <Select
                value={selectedPeriodId}
                onValueChange={(periodId) => {
                  setSelectedGradingPeriodId(periodId)
                  setOpenSubjectId(null)
                }}
              >
                <SelectTrigger id="parent-grades-period" className="min-h-10 w-full">
                  <SelectValue placeholder="Choisir une période" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : periods.length === 1 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {periods[0]!.label}
              {gradesQuery.data?.schoolYear.label ? ` · ${gradesQuery.data.schoolYear.label}` : ""}
            </p>
          ) : null}
          {periods.length > 1 && gradesQuery.data?.schoolYear.label ? (
            <p className="text-sm text-muted-foreground">
              Année scolaire active : {gradesQuery.data.schoolYear.label}
            </p>
          ) : null}

          {reportCardsQuery.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>Impossible de vérifier la disponibilité des bulletins.</span>
                <Button type="button" variant="outline" className="min-h-10" onClick={() => void reportCardsQuery.refetch()}>
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          ) : showReportCardAlert ? (
            <Alert variant="info" className="flex items-start gap-3 pr-2">
              <GraduationCap className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <AlertDescription className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  Le bulletin du {latestPublishedReportCard.periodLabel} est disponible.
                </span>
                <Link
                  to={`/parent/report-cards?student=${encodeURIComponent(selectedStudentId)}`}
                  className="inline-flex min-h-6 items-center font-semibold underline underline-offset-4"
                >
                  Consulter le bulletin
                </Link>
              </AlertDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-12 w-12 shrink-0"
                aria-label="Fermer l’alerte du bulletin"
                onClick={() => setDismissedReportCardId(latestPublishedReportCard.id)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Alert>
          ) : null}

          {gradesQuery.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>Impossible de charger les résultats de cet enfant.</span>
                <Button type="button" variant="outline" className="min-h-12" onClick={() => void gradesQuery.refetch()}>
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          ) : gradesQuery.isPending || gradesQuery.isFetching ? (
            <div role="status" aria-label="Chargement des résultats" className="space-y-3">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <span className="sr-only">Chargement des résultats…</span>
            </div>
          ) : resultsInRevision && subjects.length === 0 && conductGrade === null ? (
            <Alert role="status">
              <AlertDescription>Résultats en cours de révision par l’établissement</AlertDescription>
            </Alert>
          ) : subjects.length === 0 && conductGrade === null ? (
            <EmptyState
              title="Aucun résultat disponible"
              description="Les résultats apparaîtront ici après validation des moyennes par l’enseignant"
            />
          ) : (
            <section aria-label="Résultats validés" className="space-y-3">
              {resultsInRevision ? (
                <Alert role="status">
                  <AlertDescription>
                    Certains résultats sont en cours de révision par l’établissement.
                  </AlertDescription>
                </Alert>
              ) : null}
              {conductGrade !== null ? (
                <Card className="border-primary/20 bg-primary/[0.03] shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between gap-3 p-4">
                  <div>
                    <CardTitle className="text-base">Conduite</CardTitle>
                    <CardDescription className="mt-1">Note validée pour cette période</CardDescription>
                  </div>
                  <p className="shrink-0 text-xl font-semibold tabular-nums">
                    {formatAverage.format(conductGrade)}
                    <span className="text-sm font-medium text-muted-foreground"> / 20</span>
                  </p>
                </CardHeader>
                </Card>
              ) : null}
              <div className="space-y-3">
                {subjects.map((subject) => (
                <Collapsible
                  key={subject.id}
                  className="group/subject"
                  open={openSubjectId === subject.id}
                  onOpenChange={(open) => setOpenSubjectId(open ? subject.id : null)}
                >
                  <Card
                    data-testid={`parent-grade-subject-${subject.id}`}
                    className="min-w-0 border-border shadow-sm transition-colors group-data-[state=open]/subject:border-primary"
                  >
                    <CardHeader className="p-0">
                      <h2>
                        <CollapsibleTrigger
                          className="group flex min-h-16 w-full items-center justify-between gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          aria-label={`Notes et évaluations de ${subject.name}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-base font-semibold leading-snug">
                              {subject.name}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {subject.evaluations.length} évaluation{subject.evaluations.length > 1 ? "s" : ""} · moyenne validée
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {subject.average === null ? (
                              <span className="text-right text-sm text-muted-foreground">Indisponible</span>
                            ) : (
                              <span className="text-right">
                                <span className="block text-xl font-semibold tabular-nums">
                                  {formatAverage.format(subject.average)}
                                  <span className="text-sm font-medium text-muted-foreground"> / 20</span>
                                </span>
                              </span>
                            )}
                            <ChevronDown
                              className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                              aria-hidden="true"
                            />
                          </span>
                        </CollapsibleTrigger>
                      </h2>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="px-4 pb-2">
                        {subject.evaluations.length === 0 ? (
                          <p className="border-t py-3 text-sm text-muted-foreground">
                            Aucune évaluation détaillée disponible.
                          </p>
                        ) : (
                          <ul className="divide-y border-t">
                            {subject.evaluations.map((evaluation) => (
                              <li key={evaluation.id} className="flex min-w-0 items-start justify-between gap-3 py-3">
                                <div className="min-w-0 flex-1">
                                  <p className="break-words text-sm font-medium">{evaluation.label}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {formatEvaluationDate(evaluation.date)} · {evaluation.type === "spontaneous" ? "Note spontanée" : "Évaluation"} · Coefficient {formatNumber.format(evaluation.coefficient)}
                                  </p>
                                </div>
                                <p className="shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums">
                                  {formatScore(evaluation)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
