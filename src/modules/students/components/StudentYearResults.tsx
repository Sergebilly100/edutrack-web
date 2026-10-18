import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { getStudentYearResults, type StudentYearResults as StudentYearResultsData } from "@/modules/students/students.api"

const numberLabel = (value: number) => new Intl.NumberFormat("fr-CI", { maximumFractionDigits: 2 }).format(value)
const ALL_FILTER = "all"

type ResultType = "evaluations" | "averages" | "conduct"

const rankLabel = (rank: number) => rank === 1 ? "Rang : 1er" : `Rang : ${numberLabel(rank)}e `

const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-CI", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${value}T00:00:00.000Z`))

function EvaluationRows({ rows }: { rows: StudentYearResultsData["evaluations"] }) {
  return <ul className="divide-y rounded-md border px-3">
    {rows.map((row) => <li key={row.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{row.label}</p>
          <Badge variant="outline" className="font-normal">{row.periodLabel}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">
          {row.subjectName ?? "Matière non renseignée"}
          {" · "}
          {row.evaluationDate ? `Le ${dateLabel(row.evaluationDate)}` : "Date non renseignée"}
          {" · "}
          {row.teacherName ? `Professeur ${row.teacherName}` : "Professeur non renseigné"}
          {" · Coefficient "}
          {numberLabel(row.coefficient)}
        </p>
      </div>
      <strong className="shrink-0 tabular-nums sm:text-right">{numberLabel(row.score)}/{numberLabel(row.maxScore)}</strong>
    </li>)}
  </ul>
}

function AverageRows({ rows }: { rows: StudentYearResultsData["averages"] }) {
  return <ul className="divide-y rounded-md border px-3">
    {rows.map((row) => <li key={row.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{row.subjectName ?? "Moyenne générale"}</p>
          <Badge variant="outline" className="font-normal">{row.periodLabel}</Badge>
        </div>
        {row.rank !== null ? <p className="mt-1 text-muted-foreground">{rankLabel(row.rank)}</p> : null}
      </div>
      <strong className="shrink-0 tabular-nums sm:text-right">{numberLabel(row.average)}/20</strong>
    </li>)}
  </ul>
}

function ConductRows({ rows }: { rows: StudentYearResultsData["conduct"] }) {
  return <ul className="divide-y rounded-md border px-3">
    {rows.map((row) => <li key={row.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{row.periodLabel}</p>
        <span className="text-muted-foreground">Coefficient {numberLabel(row.coefficient)}</span>
      </div>
      <strong className="shrink-0 tabular-nums sm:text-right">{numberLabel(row.note)}/20</strong>
    </li>)}
  </ul>
}

export function StudentYearResults({ studentId, schoolYearId, schoolYearLabel }: { studentId: string; schoolYearId: string; schoolYearLabel: string }) {
  const [periodFilter, setPeriodFilter] = useState(ALL_FILTER)
  const [subjectFilter, setSubjectFilter] = useState(ALL_FILTER)
  const [resultType, setResultType] = useState<ResultType>("evaluations")
  useEffect(() => {
    setPeriodFilter(ALL_FILTER)
    setSubjectFilter(ALL_FILTER)
    setResultType("evaluations")
  }, [studentId, schoolYearId])
  const query = useQuery({
    queryKey: ["students", studentId, "year-results", schoolYearId],
    queryFn: () => getStudentYearResults(studentId, schoolYearId),
  })
  const results = query.data
  const periods = results?.periods ?? []
  const subjects = useMemo(() => results ? [...new Set([
    ...results.evaluations.flatMap((row) => row.subjectName ? [row.subjectName] : []),
    ...results.averages.flatMap((row) => row.subjectName ? [row.subjectName] : []),
  ])].sort((first, second) => first.localeCompare(second, "fr-CI", { numeric: true })) : [], [results])

  if (query.isLoading) return <Skeleton className="h-40 w-full" aria-label="Chargement des résultats" />
  if (query.isError) return <QueryErrorState title="Résultats indisponibles" message={`Impossible de charger les résultats de ${schoolYearLabel}.`} onRetry={() => void query.refetch()} />
  if (!results || (results.evaluations.length === 0 && results.averages.length === 0 && results.conduct.length === 0)) {
    return <EmptyState title="Aucun résultat saisi" description={`Aucune note ni moyenne n’est disponible pour ${schoolYearLabel}.`} />
  }

  const selectedPeriodId = periodFilter === ALL_FILTER ? null : periodFilter
  const filteredEvaluations = results.evaluations.filter((row) =>
    (selectedPeriodId === null || row.gradingPeriodId === selectedPeriodId)
    && (subjectFilter === ALL_FILTER || row.subjectName === subjectFilter))
  const filteredAverages = results.averages.filter((row) =>
    (selectedPeriodId === null || row.gradingPeriodId === selectedPeriodId)
    && (subjectFilter === ALL_FILTER || row.subjectName === subjectFilter))
  const filteredConduct = results.conduct.filter((row) =>
    selectedPeriodId === null || row.gradingPeriodId === selectedPeriodId)
  const currentCount = resultType === "evaluations" ? filteredEvaluations.length
    : resultType === "averages" ? filteredAverages.length
      : filteredConduct.length
  const currentScope = resultType === "evaluations" ? "les évaluations"
    : resultType === "averages" ? "les moyennes"
      : "la conduite"
  const hasActiveFilters = periodFilter !== ALL_FILTER || subjectFilter !== ALL_FILTER
  const showSubjectFilter = resultType !== "conduct"

  const handleResultTypeChange = (value: string) => {
    if (value === "evaluations" || value === "averages" || value === "conduct") {
      setResultType(value)
    }
  }

  const renderNoResults = (label: string) => (
    <EmptyState
      title="Aucun résultat pour ces filtres"
      description={`Aucune donnée de ${label.toLowerCase()} ne correspond à la période ou à la matière choisie.`}
      classNameRendu="py-8"
    />
  )

  return <div className="space-y-5" aria-label={`Résultats scolaires ${schoolYearLabel}`}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold">Notes et moyennes</h2>
        <p className="mt-1 text-sm text-muted-foreground">{schoolYearLabel}</p>
      </div>
      <Badge variant="secondary" className="w-fit">Consultation seule</Badge>
    </div>

    <div className="space-y-4 rounded-lg border bg-muted/20 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="student-results-period">Période</Label>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger id="student-results-period" className="min-h-12 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>Toutes les périodes</SelectItem>
                {periods.map((period) => <SelectItem key={period.id} value={period.id} disabled={period.isFuture}>
                  {period.label}
                  {period.isCurrent ? " · En cours" : period.isFuture ? ` · À venir, commence le ${dateLabel(period.startDate)}` : ""}
                </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="student-results-subject">Matière · notes et moyennes</Label>
            <Select value={subjectFilter} onValueChange={setSubjectFilter} disabled={!showSubjectFilter || subjects.length === 0}>
              <SelectTrigger id="student-results-subject" className="min-h-12 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>Toutes les matières</SelectItem>
                {subjects.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="min-h-12 shrink-0 self-end sm:self-auto"
          disabled={!hasActiveFilters}
          onClick={() => {
            setPeriodFilter(ALL_FILTER)
            setSubjectFilter(ALL_FILTER)
          }}
        >
          Réinitialiser les filtres
        </Button>
      </div>

      <Tabs value={resultType} onValueChange={handleResultTypeChange}>
        <TabsList className="grid h-auto min-h-12 w-full grid-cols-3 gap-1 p-1">
          <TabsTrigger value="evaluations" className="min-h-11 gap-2">
            <span>Évaluations</span><span className="text-xs text-muted-foreground">({filteredEvaluations.length})</span>
          </TabsTrigger>
          <TabsTrigger value="averages" className="min-h-11 gap-2">
            <span>Moyennes</span><span className="text-xs text-muted-foreground">({filteredAverages.length})</span>
          </TabsTrigger>
          <TabsTrigger value="conduct" className="min-h-11 gap-2">
            <span>Conduite</span><span className="text-xs text-muted-foreground">({filteredConduct.length})</span>
          </TabsTrigger>
        </TabsList>

        <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
          {currentCount === 0 ? "Aucun" : currentCount} résultat{currentCount > 1 ? "s" : ""} · {currentScope} · {schoolYearLabel}
        </p>

        <TabsContent value="evaluations" className="mt-4">
          {filteredEvaluations.length === 0 ? renderNoResults("évaluation") : <EvaluationRows rows={filteredEvaluations} />}
        </TabsContent>
        <TabsContent value="averages" className="mt-4">
          {filteredAverages.length === 0 ? renderNoResults("moyenne") : <AverageRows rows={filteredAverages} />}
        </TabsContent>
        <TabsContent value="conduct" className="mt-4">
          {filteredConduct.length === 0 ? renderNoResults("note de conduite") : <ConductRows rows={filteredConduct} />}
        </TabsContent>
      </Tabs>
    </div>
  </div>
}
