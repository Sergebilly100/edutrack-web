import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, CalendarPlus, CheckCircle2, ClipboardCheck, Loader2, Minus, Plus, Sparkles } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { listStudents, type StudentItem } from "@/modules/students/students.api"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  createEvaluation,
  createSpontaneousGrade,
  dayLabel,
  fetchEvaluationsScope,
  fetchTeacherAcademicContext,
  markSubjectCompleted,
  upsertEvaluationGrade,
  type EvaluationWithGrades,
} from "./academic.api"

const GRADE_MAX = 20
const sameSubject = (left: string, right: string) =>
  left.localeCompare(right, "fr", { sensitivity: "base" }) === 0

export default function NotesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "")
  const [selectedPeriodId, setSelectedPeriodId] = useState(searchParams.get("gradingPeriodId") ?? "")
  const [createOpen, setCreateOpen] = useState(false)
  const [spontaneousOpen, setSpontaneousOpen] = useState(false)
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ label: "", lessonSlotId: "", subjectId: "", coefficient: "1" })
  const [quickDraft, setQuickDraft] = useState({
    lessonSlotId: searchParams.get("lessonSlotId") ?? "",
    studentId: "",
    adjustment: "1",
    comment: "",
  })

  const contextQuery = useQuery({
    queryKey: ["academic", "teacher-context"],
    queryFn: fetchTeacherAcademicContext,
  })
  const selectedClass = contextQuery.data?.classes.find((item) => item.id === classId)
  const periods = useMemo(
    () => (contextQuery.data?.gradingPeriods ?? []).filter(
      (period) => !selectedClass || period.schoolYearId === selectedClass.schoolYearId,
    ),
    [contextQuery.data?.gradingPeriods, selectedClass],
  )
  const gradingPeriodId = selectedPeriodId || periods.find((period) => period.isCurrent)?.id || ""
  const activePeriod = periods.find((period) => period.id === gradingPeriodId)
  const isPeriodReadOnly = activePeriod?.isCurrent === false

  const scopeEnabled = Boolean(classId) && Boolean(gradingPeriodId)
  const scopeQuery = useQuery({
    queryKey: ["evaluations-scope", classId, gradingPeriodId],
    queryFn: () => fetchEvaluationsScope(classId, gradingPeriodId),
    enabled: scopeEnabled,
  })
  const studentsQuery = useQuery({
    queryKey: ["students-list", classId],
    queryFn: () => listStudents({ classId, isActive: true, limit: 100 }),
    enabled: Boolean(classId),
  })
  const invalidateScope = () =>
    queryClient.invalidateQueries({ queryKey: ["evaluations-scope", classId, gradingPeriodId] })

  const createMutation = useMutation({
    mutationFn: () => createEvaluation({
      lessonSlotId: draft.lessonSlotId,
      subjectId: draft.subjectId,
      classId,
      gradingPeriodId,
      type: "scheduled",
      coefficient: Number(draft.coefficient),
      label: draft.label.trim(),
    }),
    onSuccess: async () => {
      await invalidateScope()
      setCreateOpen(false)
      setDraft({ label: "", lessonSlotId: "", subjectId: "", coefficient: "1" })
      toast({ title: "Évaluation programmée" })
    },
    onError: (error) => toast({
      title: "Création impossible",
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    }),
  })

  const spontaneousMutation = useMutation({
    mutationFn: () => {
      const slot = scopeQuery.data?.lessonSlots.find((item) => item.id === quickDraft.lessonSlotId)
      const subject = scopeQuery.data?.subjects.find((item) => slot && sameSubject(item.name, slot.subjectName))
      if (!subject) throw new Error("La matière du créneau n’est pas paramétrée pour cette classe.")
      return createSpontaneousGrade({
        lessonSlotId: quickDraft.lessonSlotId,
        subjectId: subject.id,
        classId,
        gradingPeriodId,
        studentId: quickDraft.studentId,
        adjustment: Number(quickDraft.adjustment.replace(",", ".")),
        comment: quickDraft.comment.trim(),
      })
    },
    onSuccess: async () => {
      await invalidateScope()
      setQuickDraft((previous) => ({ ...previous, studentId: "", adjustment: "1", comment: "" }))
      setSpontaneousOpen(false)
      toast({ title: "Note spontanée enregistrée" })
    },
    onError: (error) => toast({
      title: "Enregistrement impossible",
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    }),
  })

  const completionMutation = useMutation({
    mutationFn: (input: { subjectId: string; status: "in_progress" | "completed" }) =>
      markSubjectCompleted({ classId, subjectId: input.subjectId, gradingPeriodId, status: input.status }),
    onSuccess: async (_data, variables) => {
      await invalidateScope()
      if (variables.status === "in_progress") {
        navigate(`/academic/calculation?classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(gradingPeriodId)}&subjectId=${encodeURIComponent(variables.subjectId)}`)
        return
      }
      toast({ title: "Moyennes validées et transmises à l’administration" })
    },
    onError: (error) => toast({
      title: "Mise à jour impossible",
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    }),
  })

  const scheduledEvaluations = scopeQuery.data?.evaluations.filter((item) => item.type === "scheduled") ?? []
  const scheduledCountBySubject = new Map<string, number>()
  for (const evaluation of scheduledEvaluations) {
    if (evaluation.subjectId) scheduledCountBySubject.set(evaluation.subjectId, (scheduledCountBySubject.get(evaluation.subjectId) ?? 0) + 1)
  }
  const completionBySubject = new Map((scopeQuery.data?.completion ?? []).map((item) => [item.subjectId, item]))
  const isSubjectClosed = (subjectId: string | null | undefined) =>
    isPeriodReadOnly || Boolean(subjectId && completionBySubject.get(subjectId)?.calculationStarted)
  const quickSlot = scopeQuery.data?.lessonSlots.find((item) => item.id === quickDraft.lessonSlotId)
  const quickSubject = scopeQuery.data?.subjects.find((item) => quickSlot && sameSubject(item.name, quickSlot.subjectName))
  const canCreate = draft.label.trim() !== "" && draft.lessonSlotId !== "" && draft.subjectId !== ""
    && Number.isFinite(Number(draft.coefficient)) && Number(draft.coefficient) > 0
  const canSaveSpontaneous = quickDraft.lessonSlotId !== "" && quickDraft.studentId !== ""
    && quickDraft.comment.trim() !== "" && Number.isFinite(Number(quickDraft.adjustment.replace(",", ".")))
    && Number(quickDraft.adjustment.replace(",", ".")) !== 0 && Math.abs(Number(quickDraft.adjustment.replace(",", "."))) <= 20
  const selectedEvaluation = scheduledEvaluations.find((evaluation) => evaluation.id === selectedEvaluationId) ?? null

  return (
    <div className="space-y-6 px-1 py-1 md:px-6 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Espace d’enseignement</p>
          <h1 className="text-2xl font-semibold tracking-tight">Évaluations & notes</h1>
          <p className="text-sm text-muted-foreground">Préparez, notez et validez vos matières pour une classe et une période précises.</p>
        </div>
      </header>

      <section aria-label="Contexte de notation" className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="font-semibold">Classe et période</h2><p className="text-sm text-muted-foreground">Toutes les actions ci-dessous concernent cette sélection.</p></div>{selectedClass && gradingPeriodId ? <Badge variant={isPeriodReadOnly ? "outline" : "secondary"}>{selectedClass.name} · {activePeriod?.label}{isPeriodReadOnly ? " · lecture seule" : " · en cours"}</Badge> : null}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Classe enseignée</Label>
            <Select value={classId || "none"} onValueChange={(value) => {
              setClassId(value === "none" ? "" : value)
              setSelectedPeriodId("")
            }}>
              <SelectTrigger className="min-h-12" aria-label="Classe enseignée"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
              <SelectContent>
                {(contextQuery.data?.classes ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name} · {item.levelName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contextQuery.isError ? <p className="text-sm text-destructive">Impossible de charger vos classes.</p> : null}
          </div>
          <div className="space-y-2">
            <Label>Période de calcul</Label>
            <Select value={gradingPeriodId || "none"} onValueChange={(value) => setSelectedPeriodId(value === "none" ? "" : value)}>
              <SelectTrigger className="min-h-12" aria-label="Période de calcul"><SelectValue placeholder="Choisir une période" /></SelectTrigger>
              <SelectContent>
                {periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}{period.isCurrent ? " · en cours" : period.isCompleted ? " · finalisée" : " · à venir"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {scopeEnabled ? <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="min-h-12 sm:flex-1" onClick={() => setSpontaneousOpen(true)} disabled={isPeriodReadOnly || (scopeQuery.data?.lessonSlots.length ?? 0) === 0}><Sparkles className="mr-2 h-4 w-4" />Ajouter une note spontanée</Button><Button type="button" className="min-h-12 sm:flex-1" disabled={isPeriodReadOnly} onClick={() => setCreateOpen(true)}><CalendarPlus className="mr-2 h-4 w-4" />Programmer une évaluation</Button></div> : null}
      </section>

      {!scopeEnabled ? (
        <EmptyState title="Choisissez une classe et une période" description="Vos évaluations et vos élèves s’afficheront ici." />
      ) : scopeQuery.isLoading || studentsQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
      ) : scopeQuery.isError || studentsQuery.isError ? (
        <p className="text-sm text-destructive">Impossible de charger votre espace de notation pour cette classe.</p>
      ) : (
        <>
          {isPeriodReadOnly ? <div className="rounded-lg border border-muted-foreground/20 bg-muted/40 p-4 text-sm text-muted-foreground">Cette période reste consultable, mais elle est verrouillée car les bulletins ont déjà été générés ou parce qu’elle n’est pas encore la période courante.</div> : null}
          <section aria-labelledby="evaluations-title" className="space-y-4 rounded-lg border bg-card p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4"><div className="space-y-1"><h2 id="evaluations-title" className="text-lg font-semibold">Évaluations programmées</h2><p className="text-sm text-muted-foreground">Le coefficient pondère cette évaluation, sans modifier celui de la matière.</p></div><Badge variant="outline">{scheduledEvaluations.length} prévue{scheduledEvaluations.length > 1 ? "s" : ""}</Badge></div>
            <div className="space-y-3">
              {scheduledEvaluations.length === 0 ? <EmptyState title="Aucune évaluation programmée" description="Créez une évaluation rattachée à l’un de vos créneaux." /> : scheduledEvaluations.map((evaluation) => (
                <EvaluationGradeEditor key={evaluation.id} evaluation={evaluation} students={studentsQuery.data?.data ?? []} readOnly={isSubjectClosed(evaluation.subjectId)} onOpen={() => setSelectedEvaluationId(evaluation.id)} />
              ))}
            </div>
          </section>

          <section aria-labelledby="calculation-title" className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
            <div className="mb-4 flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted"><ClipboardCheck className="h-4 w-4" /></span><div><h2 id="calculation-title" className="font-semibold">Clôturer et calculer par matière</h2><p className="text-sm text-muted-foreground">Lorsque toutes les notes sont renseignées, fermez la saisie de cette matière. Vous pourrez contrôler les moyennes et la conduite avant validation.</p></div></div>
            <div>
              {(scopeQuery.data?.completion.length ?? 0) === 0 ? <EmptyState title="Aucune matière assignée" description="Vérifiez que les matières de vos créneaux sont paramétrées pour le niveau." /> : (
                <div className="divide-y rounded-lg border">
                  {(scopeQuery.data?.completion ?? []).map((subject) => {
                    const count = scheduledCountBySubject.get(subject.subjectId) ?? 0
                    const actionLabel = subject.status === "completed" ? "Consulter les moyennes" : subject.calculationStarted ? "Ouvrir le calcul" : "Clôturer la saisie et calculer"
                    return <div key={subject.subjectId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium">{subject.subjectName}</p><p className="mt-1 text-sm text-muted-foreground">{count} évaluation{count > 1 ? "s" : ""} programmée{count > 1 ? "s" : ""}</p></div><div className="flex flex-col gap-2 sm:items-end"><span>{subject.status === "completed" ? <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />Validée</Badge> : <Badge variant="secondary">{subject.calculationStarted ? "Calcul en cours" : "Saisie en cours"}</Badge>}</span><Button type="button" variant={subject.calculationStarted ? "outline" : "default"} className="min-h-12 w-full sm:w-auto" disabled={completionMutation.isPending || (isPeriodReadOnly && !subject.calculationStarted)} onClick={() => subject.calculationStarted ? navigate(`/academic/calculation?classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(gradingPeriodId)}&subjectId=${encodeURIComponent(subject.subjectId)}`) : completionMutation.mutate({ subjectId: subject.subjectId, status: "in_progress" })}>{actionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-xl overflow-y-auto rounded-lg sm:w-full"><DialogHeader><DialogTitle>Programmer une évaluation</DialogTitle><DialogDescription>Rattachez-la à un créneau et définissez son coefficient propre.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Créneau de cours</Label><Select value={draft.lessonSlotId || "none"} onValueChange={(value) => {
              const slot = scopeQuery.data?.lessonSlots.find((item) => item.id === value)
              const subject = scopeQuery.data?.subjects.find((item) => slot && sameSubject(item.name, slot.subjectName))
              setDraft((previous) => ({ ...previous, lessonSlotId: value === "none" ? "" : value, subjectId: subject?.id ?? "" }))
            }}><SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir un créneau" /></SelectTrigger><SelectContent>{(scopeQuery.data?.lessonSlots ?? []).map((slot) => <SelectItem key={slot.id} value={slot.id}>{dayLabel(slot.dayOfWeek)} {slot.startTime}-{slot.endTime} · {slot.subjectName}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Matière</Label><Select value={draft.subjectId || "none"} onValueChange={(value) => setDraft((previous) => ({ ...previous, subjectId: value === "none" ? "" : value }))}><SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir une matière" /></SelectTrigger><SelectContent>{(scopeQuery.data?.subjects ?? []).map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name} · coef. matière {subject.coefficient}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Libellé</Label><Input placeholder="Devoir surveillé n°1" value={draft.label} onChange={(event) => setDraft((previous) => ({ ...previous, label: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Coefficient de cette évaluation</Label><Input type="number" min={0.25} step={0.25} value={draft.coefficient} onChange={(event) => setDraft((previous) => ({ ...previous, coefficient: event.target.value }))} /><p className="text-xs text-muted-foreground">Ce coefficient ne modifie pas le coefficient général de la matière.</p></div>
          </div>
          <DialogFooter><Button type="button" disabled={!canCreate || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Programmer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <EvaluationGradesDialog
        evaluation={selectedEvaluation}
        students={studentsQuery.data?.data ?? []}
        readOnly={selectedEvaluation ? isSubjectClosed(selectedEvaluation.subjectId) : true}
        onOpenChange={(open) => !open && setSelectedEvaluationId(null)}
      />

      <Dialog open={spontaneousOpen} onOpenChange={setSpontaneousOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-xl overflow-y-auto rounded-lg sm:w-full"><DialogHeader><DialogTitle>Note spontanée, pendant le cours</DialogTitle><DialogDescription>Choisissez l’élève et le cours concernés.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Attribuez +1, +2, −1, −2, etc. Le justificatif reste obligatoire.</p>
            <div className="space-y-2"><Label>Créneau</Label><Select value={quickDraft.lessonSlotId || "none"} onValueChange={(value) => setQuickDraft((previous) => ({ ...previous, lessonSlotId: value === "none" ? "" : value }))}><SelectTrigger className="min-h-12" aria-label="Créneau"><SelectValue placeholder="Cours concerné" /></SelectTrigger><SelectContent>{(scopeQuery.data?.lessonSlots ?? []).map((slot) => <SelectItem key={slot.id} value={slot.id}>{dayLabel(slot.dayOfWeek)} {slot.startTime} · {slot.subjectName}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Élève</Label><Select disabled={isSubjectClosed(quickSubject?.id)} value={quickDraft.studentId || "none"} onValueChange={(value) => setQuickDraft((previous) => ({ ...previous, studentId: value === "none" ? "" : value }))}><SelectTrigger className="min-h-12" aria-label="Élève"><SelectValue placeholder="Choisir un élève" /></SelectTrigger><SelectContent>{(studentsQuery.data?.data ?? []).map((student) => <SelectItem key={student.id} value={student.id}>{student.firstName} {student.lastName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end"><div className="space-y-2"><Label>Sens</Label><div className="flex gap-2" aria-label="Sens de la note spontanée"><Button type="button" disabled={isSubjectClosed(quickSubject?.id)} variant={Number(quickDraft.adjustment.replace(",", ".")) >= 0 ? "default" : "outline"} className="min-h-12 min-w-12" aria-label="Note positive" onClick={() => setQuickDraft((previous) => ({ ...previous, adjustment: String(Math.abs(Number(previous.adjustment.replace(",", "."))) || 1) }))}><Plus className="h-4 w-4" /></Button><Button type="button" disabled={isSubjectClosed(quickSubject?.id)} variant={Number(quickDraft.adjustment.replace(",", ".")) < 0 ? "destructive" : "outline"} className="min-h-12 min-w-12" aria-label="Note négative" onClick={() => setQuickDraft((previous) => ({ ...previous, adjustment: String(-Math.abs(Number(previous.adjustment.replace(",", "."))) || -1) }))}><Minus className="h-4 w-4" /></Button></div></div><div className="space-y-2"><Label htmlFor="spontaneous-adjustment">Points</Label><Input id="spontaneous-adjustment" disabled={isSubjectClosed(quickSubject?.id)} type="number" min={-20} max={20} step={0.25} value={quickDraft.adjustment} onChange={(event) => setQuickDraft((previous) => ({ ...previous, adjustment: event.target.value }))} /></div></div>
            <div className="space-y-2"><Label htmlFor="spontaneous-comment">Justificatif</Label><Input id="spontaneous-comment" disabled={isSubjectClosed(quickSubject?.id)} value={quickDraft.comment} placeholder="Bonne réponse, participation, perturbation…" onChange={(event) => setQuickDraft((previous) => ({ ...previous, comment: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button type="button" disabled={isSubjectClosed(quickSubject?.id) || !canSaveSpontaneous || spontaneousMutation.isPending} onClick={() => spontaneousMutation.mutate()}>{spontaneousMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EvaluationGradeEditor({ evaluation, students, readOnly, onOpen }: { evaluation: EvaluationWithGrades; students: StudentItem[]; readOnly: boolean; onOpen: () => void }) {
  const completedCount = evaluation.grades.length
  const totalCount = students.length
  return <div className="rounded-lg border bg-background p-4 transition-colors hover:bg-muted/20">
    <Button type="button" variant="ghost" className="min-h-12 w-full justify-between gap-3 px-0 text-left" onClick={onOpen}>
      <span className="min-w-0"><span className="block truncate font-semibold">{evaluation.label}</span><span className="mt-1 block text-xs text-muted-foreground">{evaluation.subjectName ?? "-"} · Coef. évaluation {evaluation.coefficient}</span></span>
      <span className="shrink-0 text-right"><Badge variant={readOnly ? "outline" : "secondary"}>{readOnly ? "Saisie clôturée" : `${completedCount}/${totalCount} notes`}</Badge><span className="mt-1 block text-xs text-muted-foreground">{readOnly ? "Consulter les notes" : "Saisir les notes"}</span></span>
    </Button>
  </div>
}

function EvaluationGradesDialog({ evaluation, students, readOnly, onOpenChange }: { evaluation: EvaluationWithGrades | null; students: StudentItem[]; readOnly: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const gradeMutation = useMutation({
    mutationFn: (input: { studentId: string; score: number }) => {
      if (!evaluation) throw new Error("Évaluation introuvable")
      return upsertEvaluationGrade(evaluation.id, { studentId: input.studentId, score: input.score, maxScore: GRADE_MAX })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["evaluations-scope"] })
      toast({ title: "Note enregistrée" })
    },
    onError: (error) => toast({ title: "Enregistrement impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })

  return <Dialog open={Boolean(evaluation)} onOpenChange={onOpenChange}>
    <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg p-0 sm:w-full">
      <DialogHeader className="border-b px-5 py-5 text-left sm:px-6">
        <DialogTitle>Saisie des notes</DialogTitle>
        <DialogDescription>{evaluation ? `${evaluation.label} · ${evaluation.subjectName ?? "Matière"} · coef. ${evaluation.coefficient}` : ""}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
        {evaluation && students.length === 0 ? <EmptyState title="Aucun élève actif" description="La classe ne contient aucun élève disponible pour la saisie." /> : null}
        {evaluation && students.length > 0 ? <div className="divide-y rounded-lg border">{students.map((student) => <GradeRow key={`${evaluation.id}-${student.id}-${evaluation.grades.find((item) => item.studentId === student.id)?.score ?? "empty"}`} fullName={`${student.firstName} ${student.lastName}`} initialScore={String(evaluation.grades.find((item) => item.studentId === student.id)?.score ?? "")} readOnly={readOnly} onSave={(score) => gradeMutation.mutateAsync({ studentId: student.id, score })} />)}</div> : null}
      </div>
    </DialogContent>
  </Dialog>
}

function GradeRow({ fullName, initialScore, onSave, readOnly }: { fullName: string; initialScore: string; onSave: (score: number) => Promise<unknown>; readOnly: boolean }) {
  const [score, setScore] = useState(initialScore)
  const parsed = Number(score.replace(",", "."))
  const valid = score !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= GRADE_MAX
  return <div className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:px-4"><p className="min-w-0 flex-1 font-medium">{fullName}</p><div className="flex w-full items-center gap-2 sm:w-auto"><div className="flex-1 sm:w-28"><Label className="sr-only" htmlFor={`grade-${fullName}`}>Note de {fullName}</Label><Input id={`grade-${fullName}`} aria-label={`Note de ${fullName}`} disabled={readOnly} type="number" min={0} max={GRADE_MAX} step={0.25} className="min-h-12" value={score} onChange={(event) => setScore(event.target.value)} /></div><span className="text-sm text-muted-foreground">/ {GRADE_MAX}</span><Button type="button" variant="outline" className="min-h-12" disabled={readOnly || !valid} onClick={() => void onSave(parsed)}>Enregistrer</Button></div></div>
}
