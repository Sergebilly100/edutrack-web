import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import { useAuthStore } from "@/shared/store/auth.store"
import { decideConductGrade, fetchConductDecisionStudents, fetchConductOverview, fetchConductDecisionWorkspace } from "./academic.api"

export default function ConductDecisionWorkspace() {
  const role = useAuthStore((state) => state.user?.role)
  const [params, setParams] = useSearchParams()
  const yearId = params.get("schoolYearId") ?? ""
  const levelId = params.get("levelId") ?? ""
  const classId = params.get("classId") ?? ""
  const periodId = params.get("gradingPeriodId") ?? ""
  const [studentId, setStudentId] = useState("")
  const [note, setNote] = useState("")
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const workspaceQuery = useQuery({
    queryKey: ["conduct", "decision-workspace"], queryFn: fetchConductDecisionWorkspace,
    refetchOnMount: "always", refetchOnWindowFocus: "always", refetchInterval: 30_000,
  })
  const scopes = workspaceQuery.data?.decisionScopes ?? []
  const years = Array.from(new Map(scopes.map((item) => [item.schoolYearId, item.schoolYearLabel])).entries())
  const levels = Array.from(new Map(scopes.filter((item) => !yearId || item.schoolYearId === yearId).map((item) => [item.levelId, item.levelName])).entries())
  const classes = Array.from(new Map(scopes.filter((item) => (!yearId || item.schoolYearId === yearId) && (!levelId || item.levelId === levelId)).map((item) => [item.classId, item.className])).entries())
  const periods = scopes.filter((item) => item.classId === classId)
  const currentScope = scopes.find((item) => item.classId === classId && item.gradingPeriodId === periodId)
  const rosterQuery = useQuery({
    queryKey: ["conduct", "decision-students", classId, periodId],
    queryFn: () => fetchConductDecisionStudents(classId, periodId),
    enabled: Boolean(currentScope),
  })
  const overviewQuery = useQuery({
    queryKey: ["conduct-overview", studentId, periodId],
    queryFn: () => fetchConductOverview(studentId, periodId),
    enabled: Boolean(currentScope && studentId),
  })
  const saveMutation = useMutation({
    mutationFn: () => decideConductGrade({ student_id: studentId, grading_period_id: periodId, note: Number(note.replace(",", ".")) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conduct-overview", studentId, periodId] }),
        queryClient.invalidateQueries({ queryKey: ["conduct", "decision-workspace"] }),
        queryClient.invalidateQueries({ queryKey: ["conduct", "teacher-actions"] }),
      ])
      setNote("")
      toast({ title: "Note de conduite arrêtée" })
    },
    onError: (error) => toast({ title: "Décision impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })
  const setFilter = (key: string, value: string) => {
    setStudentId("")
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set(key, value)
      if (key === "schoolYearId") { next.delete("levelId"); next.delete("classId"); next.delete("gradingPeriodId") }
      if (key === "levelId") { next.delete("classId"); next.delete("gradingPeriodId") }
      if (key === "classId") next.delete("gradingPeriodId")
      return next
    })
  }
  const parsedNote = Number(note.replace(",", "."))
  const canSave = Boolean(workspaceQuery.isSuccess && !workspaceQuery.isFetching && currentScope?.reviewOpen && !currentScope.isClosed && studentId && note !== "" && Number.isFinite(parsedNote) && parsedNote >= 0 && parsedNote <= 20)
  const overview = overviewQuery.data

  return <div className="min-w-0 space-y-4">
    <header><h1 className="text-2xl font-semibold">Conduite</h1><p className="text-sm text-muted-foreground">Décisions des classes qui vous sont confiées.</p></header>
    {workspaceQuery.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement des classes…</p> : null}
    {workspaceQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-2"><span>Impossible de charger les décisions de conduite. Vérifiez la connexion ou les migrations de l’école.</span><Button type="button" variant="outline" className="min-h-12" onClick={() => void workspaceQuery.refetch()}>Réessayer</Button></AlertDescription></Alert> : null}
    {workspaceQuery.isSuccess && scopes.length === 0 ? <div className="space-y-3"><EmptyState title="Aucune décision autorisée" description="Vérifiez le mode de décision de l’année dans Paramètres → Personnel. L’entrée Conduite apparaît pendant la revue lorsqu’une classe vous est autorisée." />{role === "director" ? <Button asChild variant="outline" className="min-h-12"><Link to="/settings?tab=personnel">Ouvrir les paramètres de conduite</Link></Button> : null}</div> : null}
    {scopes.length > 0 ? <>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><Label htmlFor="conduct-year">Année</Label><Select value={yearId} onValueChange={(value) => setFilter("schoolYearId", value)}><SelectTrigger id="conduct-year" className="min-h-12"><SelectValue placeholder="Toutes les années" /></SelectTrigger><SelectContent>{years.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="conduct-level">Niveau</Label><Select value={levelId} onValueChange={(value) => setFilter("levelId", value)}><SelectTrigger id="conduct-level" className="min-h-12"><SelectValue placeholder="Tous les niveaux" /></SelectTrigger><SelectContent>{levels.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="conduct-class">Classe</Label><Select value={classId} onValueChange={(value) => setFilter("classId", value)}><SelectTrigger id="conduct-class" className="min-h-12"><SelectValue placeholder="Choisir une classe" /></SelectTrigger><SelectContent>{classes.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="conduct-period">Période</Label><Select value={periodId} onValueChange={(value) => setFilter("gradingPeriodId", value)}><SelectTrigger id="conduct-period" className="min-h-12"><SelectValue placeholder="Choisir une période" /></SelectTrigger><SelectContent>{periods.map((item) => <SelectItem key={item.gradingPeriodId} value={item.gradingPeriodId}>{item.gradingPeriodLabel}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {!currentScope ? <EmptyState title="Choisissez une classe et une période" description="L’avancement des décisions apparaîtra ici." /> : <>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4"><strong>{currentScope.className}</strong><Badge variant="outline">{currentScope.studentCount - currentScope.pendingCount}/{currentScope.studentCount} décisions</Badge><Badge variant="secondary">{currentScope.gradingPeriodLabel}</Badge>{currentScope.isClosed ? <span className="text-sm text-muted-foreground">Revue clôturée, lecture seule</span> : !currentScope.reviewOpen ? <span className="text-sm text-muted-foreground">Revue à venir</span> : null}</div>
        {rosterQuery.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement des élèves…</p> : null}
        {rosterQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les élèves confirmés.</AlertDescription></Alert> : null}
        {rosterQuery.isSuccess && rosterQuery.data.students.length === 0 ? <EmptyState title="Aucun élève confirmé" description="Aucune décision à prendre pour cette classe." /> : null}
        {rosterQuery.data?.students.length ? <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"><div className="max-h-[28rem] overflow-y-auto rounded-lg border bg-card" aria-label="Élèves de la classe">{rosterQuery.data.students.map((student) => <Button key={student.id} type="button" variant={studentId === student.id ? "secondary" : "ghost"} className="min-h-12 w-full justify-start rounded-none border-b text-left last:border-b-0" onClick={() => { setStudentId(student.id); setNote("") }}>{student.fullName}</Button>)}</div><section aria-label="Dossier de conduite" className="min-w-0 space-y-4 rounded-lg border bg-card p-4">{!studentId ? <p className="text-sm text-muted-foreground">Choisissez un élève pour consulter les avis et arrêter sa note.</p> : overviewQuery.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement du dossier…</p> : overviewQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger ce dossier.</AlertDescription></Alert> : overview ? <><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{overview.student.fullName}</h2><Badge variant="outline">{overview.finalGrade ? `${overview.finalGrade.note}/20 arrêtée` : "À décider"}</Badge></div><p className="text-sm text-muted-foreground">{overview.inputSummary.submittedCount}/{overview.inputSummary.expectedCount} avis reçus. Les avis manquants ne bloquent pas la décision.</p>{overview.teacherInputs.length ? <ul className="divide-y rounded-lg border">{overview.teacherInputs.map((input) => <li key={input.teacherId} className="p-3 text-sm"><strong>{input.teacherName}</strong> : {input.isSubmitted ? `${input.note}/20` : "Avis manquant"}{input.observation ? <p className="mt-1 text-muted-foreground">{input.observation}</p> : null}</li>)}</ul> : <EmptyState title="Aucun avis reçu" description="Vous pouvez arrêter la note finale." />}{overview.spontaneousEvaluations.length ? <ul className="space-y-1 text-sm">{overview.spontaneousEvaluations.map((item) => <li key={item.id}>{item.comment ?? item.label}</li>)}</ul> : null}<div className="flex flex-wrap items-end gap-3"><div className="space-y-2"><Label htmlFor="conduct-final-note">Note finale / 20</Label><Input id="conduct-final-note" type="number" min={0} max={20} step={0.5} className="w-28" value={note} onChange={(event) => setNote(event.target.value)} disabled={currentScope.isClosed || !currentScope.reviewOpen} /></div><Button type="button" className="min-h-12" onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>{saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Arrêter la note</Button></div></> : null}</section></div> : null}
      </>}
    </> : null}
  </div>
}
