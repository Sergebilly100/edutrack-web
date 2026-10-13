import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { getStudentYearResults } from "@/modules/students/students.api"

const numberLabel = (value: number) => new Intl.NumberFormat("fr-CI", { maximumFractionDigits: 2 }).format(value)

export function StudentYearResults({ studentId, schoolYearId, schoolYearLabel }: { studentId: string; schoolYearId: string; schoolYearLabel: string }) {
  const query = useQuery({
    queryKey: ["students", studentId, "year-results", schoolYearId],
    queryFn: () => getStudentYearResults(studentId, schoolYearId),
  })

  if (query.isLoading) return <Skeleton className="h-40 w-full" aria-label="Chargement des résultats" />
  if (query.isError) return <QueryErrorState title="Résultats indisponibles" message={`Impossible de charger les résultats de ${schoolYearLabel}.`} onRetry={() => void query.refetch()} />
  const results = query.data
  if (!results || (results.evaluations.length === 0 && results.averages.length === 0 && results.conduct.length === 0)) {
    return <EmptyState title="Aucun résultat saisi" description={`Aucune note ni moyenne n’est disponible pour ${schoolYearLabel}.`} />
  }

  return <div className="space-y-4" aria-label={`Résultats scolaires ${schoolYearLabel}`}>
    <p className="text-sm text-muted-foreground">Notes et moyennes de {schoolYearLabel} · consultation seule</p>
    <Card>
      <CardHeader><CardTitle className="text-base">Évaluations</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {results.evaluations.length === 0 ? <p className="text-sm text-muted-foreground">Aucune évaluation notée.</p> : results.evaluations.map((row) =>
          <div key={row.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm">
            <div className="min-w-0"><p className="font-medium">{row.label}</p><p className="text-muted-foreground">{row.periodLabel} · {row.subjectName ?? "Matière non renseignée"} · coefficient {numberLabel(row.coefficient)}</p></div>
            <strong className="tabular-nums">{numberLabel(row.score)}/{numberLabel(row.maxScore)}</strong>
          </div>) }
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-base">Moyennes</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {results.averages.length === 0 ? <p className="text-sm text-muted-foreground">Aucune moyenne calculée.</p> : results.averages.map((row) =>
          <div key={row.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm">
            <div><p className="font-medium">{row.subjectName ?? "Moyenne générale"}</p><p className="text-muted-foreground">{row.periodLabel}</p></div>
            <strong className="tabular-nums">{numberLabel(row.average)}/20</strong>
          </div>) }
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-base">Conduite</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {results.conduct.length === 0 ? <p className="text-sm text-muted-foreground">Aucune note de conduite finalisée.</p> : results.conduct.map((row) =>
          <div key={row.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm">
            <p className="font-medium">{row.periodLabel} · coefficient {numberLabel(row.coefficient)}</p>
            <strong className="tabular-nums">{numberLabel(row.note)}/20</strong>
          </div>) }
      </CardContent>
    </Card>
  </div>
}
