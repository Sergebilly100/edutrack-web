import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowRight, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import { fetchEvaluationsScope, fetchTeacherAcademicContext, markSubjectCompleted, type SubjectPreparation } from "./academic.api"
import { invalidateAcademicReportScope } from "./academic-report-cache"

const reasonText: Record<SubjectPreparation["reasons"][number], string> = {
  PERIOD_CLOSED: "Classe ou période clôturée",
  SCHOOL_YEAR_CLOSED: "Année scolaire clôturée",
  CLASS_INACTIVE: "Classe inactive",
  NO_EVALUATIONS: "Programmez au moins une évaluation",
  GRADES_INCOMPLETE: "Terminez la saisie des notes",
  SUBJECT_COMPLETED: "Moyennes validées définitivement",
}

export default function TeacherAveragesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
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
  const detailUrl = (subjectId: string) => `/academic/calculation?classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(periodId)}&subjectId=${encodeURIComponent(subjectId)}`
  const notesUrl = `/academic/notes?tab=evaluations&classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(periodId)}`
  const startMutation = useMutation({
    mutationFn: (subjectId: string) => markSubjectCompleted({ classId, subjectId, gradingPeriodId: periodId, status: "in_progress" }),
    onSuccess: async (_result, subjectId) => {
      await invalidateAcademicReportScope(queryClient, classId, periodId)
      toast({ title: "Calcul des moyennes démarré" })
      navigate(detailUrl(subjectId))
    },
    onError: (error) => toast({ title: "Calcul impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })
  const setParam = (key: string, value: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    next.set(key, value)
    if (key === "classId") next.delete("gradingPeriodId")
    return next
  })
  const periodState = scopeQuery.data?.periodState
  const preparation = scopeQuery.data?.preparation ?? []

  return <section className="space-y-4" aria-labelledby="averages-heading">
    <div><h1 id="averages-heading" className="text-2xl font-semibold">Moyennes</h1><p className="text-sm text-muted-foreground">Suivez les notes, calculez puis validez chaque matière.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="average-class">Classe</Label><Select value={classId} onValueChange={(value) => setParam("classId", value)}><SelectTrigger id="average-class" className="min-h-12"><SelectValue placeholder="Choisir une classe" /></SelectTrigger><SelectContent>{(contextQuery.data?.classes ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="average-period">Période</Label><Select value={periodId} onValueChange={(value) => setParam("gradingPeriodId", value)}><SelectTrigger id="average-period" className="min-h-12"><SelectValue placeholder="Choisir une période" /></SelectTrigger><SelectContent>{periods.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {contextQuery.isLoading || scopeQuery.isLoading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement des moyennes…</p> : null}
    {contextQuery.isError || scopeQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les moyennes. Vérifiez votre accès à cette classe et à cette période.</AlertDescription></Alert> : null}
    {!contextQuery.isLoading && contextQuery.data?.classes.length === 0 ? <EmptyState title="Aucune classe attribuée" description="Demandez à la direction de vérifier vos affectations." /> : null}
    {Boolean(contextQuery.data?.classes.length) && (!classId || !periodId) ? <EmptyState title="Choisissez une classe et une période" description="La préparation des matières apparaîtra ici." /> : null}
    {classId && periods.length === 0 && !contextQuery.isLoading ? <EmptyState title="Aucune période accessible" description="Demandez à la direction de vérifier l’année scolaire de cette classe." /> : null}
    {periodState ? <Alert><AlertDescription>{periodState.reason === "SCHOOL_YEAR_CLOSED" ? "Cette année scolaire est clôturée. Les calculs restent consultables." : periodState.reason === "CLASS_INACTIVE" ? "Cette classe est inactive. Les calculs restent consultables." : periodState.isClosed ? "Cette classe et cette période sont clôturées. Les calculs restent consultables." : periodState.reviewOpen ? "Revue en cours. Les matières restent révisables jusqu’à leur validation définitive." : "Classe et période ouvertes au calcul des moyennes."}</AlertDescription></Alert> : null}
    {scopeQuery.data && preparation.length === 0 ? <EmptyState title="Aucune matière attribuée" description="Demandez à la direction de vérifier vos matières ou choisissez une autre classe." /> : null}
    {preparation.map((subject) => {
      const completed = subject.status === "completed" && subject.calculationStarted
      const reason = subject.reasons[0]
      const canOpen = subject.calculationStarted
      return <article key={subject.subjectId} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-semibold">{subject.subjectName}</h2><Badge variant="outline">{completed ? "Validée" : subject.calculationStarted ? "En calcul" : subject.evaluationCount === 0 ? "Sans évaluation" : subject.missingGrades > 0 ? "Saisie incomplète" : "Prête à calculer"}</Badge></div>
        <p className="text-sm text-muted-foreground">{subject.evaluationCount} évaluation{subject.evaluationCount > 1 ? "s" : ""} prévue{subject.evaluationCount > 1 ? "s" : ""} · {subject.enteredGrades}/{subject.expectedGrades} notes saisies · {subject.missingGrades} manquante{subject.missingGrades > 1 ? "s" : ""}</p>
        {subject.calculationStarted ? <p className="text-sm">Moyennes disponibles dans le détail du calcul.</p> : null}
        {subject.correctionStatus ? <p className="text-sm">Réclamation : {subject.correctionStatus === "approved" ? "correction ouverte" : subject.correctionStatus === "corrected" ? "matière revalidée" : "en traitement"}</p> : null}
        {reason && !completed ? <p className="text-sm text-muted-foreground">{reasonText[reason]}{reason === "GRADES_INCOMPLETE" ? ` : ${subject.missingGrades} note${subject.missingGrades > 1 ? "s" : ""} manquante${subject.missingGrades > 1 ? "s" : ""}.` : "."}</p> : null}
        <div className="flex flex-wrap gap-2">
          {subject.canStartCalculation ? <Button className="min-h-12 w-full sm:w-auto" disabled={startMutation.isPending} onClick={() => startMutation.mutate(subject.subjectId)}>{startMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Démarrer le calcul <ArrowRight className="ml-2 h-4 w-4" /></Button> : null}
          {canOpen ? <Button asChild variant="outline" className="min-h-12 w-full sm:w-auto"><Link to={detailUrl(subject.subjectId)}>{completed ? "Consulter" : subject.canRecalculate ? "Reprendre le calcul" : "Consulter le calcul"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button> : null}
          {!completed && subject.reasons.some((item) => item === "NO_EVALUATIONS" || item === "GRADES_INCOMPLETE") ? <Button asChild variant="outline" className="min-h-12 w-full sm:w-auto"><Link to={notesUrl}>Saisir les notes</Link></Button> : null}
        </div>
      </article>
    })}
  </section>
}
