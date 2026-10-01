import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowRight, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/shared/components/EmptyState"
import { fetchEvaluationsScope, fetchTeacherAcademicContext } from "./academic.api"

export default function TeacherAveragesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const classId = searchParams.get("classId") ?? ""
  const periodId = searchParams.get("gradingPeriodId") ?? ""
  const contextQuery = useQuery({ queryKey: ["academic", "teacher-context"], queryFn: fetchTeacherAcademicContext })
  const selectedClass = contextQuery.data?.classes.find((item) => item.id === classId)
  const periods = (contextQuery.data?.gradingPeriods ?? []).filter((period) => !selectedClass || period.schoolYearId === selectedClass.schoolYearId)
  const scopeQuery = useQuery({
    queryKey: ["evaluations-scope", classId, periodId],
    queryFn: () => fetchEvaluationsScope(classId, periodId),
    enabled: Boolean(classId && periodId),
  })
  const setParam = (key: string, value: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    next.set(key, value)
    if (key === "classId") next.delete("gradingPeriodId")
    return next
  })

  return <section className="space-y-4" aria-labelledby="averages-heading">
    <div><h1 id="averages-heading" className="text-2xl font-semibold">Moyennes</h1><p className="text-sm text-muted-foreground">Résultats et calculs de vos matières.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="average-class">Classe</Label><Select value={classId} onValueChange={(value) => setParam("classId", value)}><SelectTrigger id="average-class" className="min-h-12"><SelectValue placeholder="Choisir une classe" /></SelectTrigger><SelectContent>{(contextQuery.data?.classes ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="average-period">Période</Label><Select value={periodId} onValueChange={(value) => setParam("gradingPeriodId", value)}><SelectTrigger id="average-period" className="min-h-12"><SelectValue placeholder="Choisir une période" /></SelectTrigger><SelectContent>{periods.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {contextQuery.isLoading || scopeQuery.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement des moyennes…</p> : null}
    {contextQuery.isError || scopeQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les moyennes.</AlertDescription></Alert> : null}
    {!classId || !periodId ? <EmptyState title="Choisissez une classe et une période" description="Les matières apparaîtront ici." /> : null}
    {scopeQuery.data && scopeQuery.data.completion.length === 0 ? <EmptyState title="Aucune matière à calculer" description="Les matières attribuées apparaîtront ici." /> : null}
    {scopeQuery.data?.completion.map((subject) => <div key={subject.subjectId} className="flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3"><span className="font-medium">{subject.subjectName}</span><div className="flex items-center gap-2"><Badge variant="outline">{subject.status === "completed" ? "Validée" : subject.calculationStarted ? "En calcul" : "À calculer"}</Badge><Button asChild variant="outline" className="min-h-12"><Link to={`/academic/calculation?classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(periodId)}&subjectId=${encodeURIComponent(subject.subjectId)}`}>Ouvrir <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></div>)}
  </section>
}
