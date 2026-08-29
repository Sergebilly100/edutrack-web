import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Loader2, Minus, Plus } from "lucide-react"
import { Link, useLocation, useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  const [searchParams] = useSearchParams()
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "")
  const [selectedPeriodId, setSelectedPeriodId] = useState(searchParams.get("gradingPeriodId") ?? "")
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState({ label: "", lessonSlotId: "", subjectId: "", coefficient: "1" })
  const [quickDraft, setQuickDraft] = useState({
    lessonSlotId: searchParams.get("lessonSlotId") ?? "",
    studentId: "",
    polarity: "positive" as "positive" | "negative",
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
  const today = new Date().toISOString().slice(0, 10)
  const automaticPeriodId = periods.find((period) => period.startDate <= today && period.endDate >= today)?.id ?? ""
  const gradingPeriodId = selectedPeriodId || automaticPeriodId
  const selectedPeriod = periods.find((period) => period.id === gradingPeriodId)
  const periodEnded = Boolean(selectedPeriod && today > selectedPeriod.endDate)

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
        polarity: quickDraft.polarity,
        comment: quickDraft.comment.trim(),
      })
    },
    onSuccess: async () => {
      await invalidateScope()
      setQuickDraft((previous) => ({ ...previous, studentId: "", polarity: "positive", comment: "" }))
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
      toast({
        title: variables.status === "completed"
          ? "Moyennes validées et transmises à l’administration"
          : "Calcul des moyennes activé",
      })
    },
    onError: (error) => toast({
      title: "Mise à jour impossible",
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    }),
  })

  const scheduledEvaluations = scopeQuery.data?.evaluations.filter((item) => item.type === "scheduled") ?? []
  const canCreate = draft.label.trim() !== "" && draft.lessonSlotId !== "" && draft.subjectId !== ""
    && Number.isFinite(Number(draft.coefficient)) && Number(draft.coefficient) > 0
  const canSaveSpontaneous = quickDraft.lessonSlotId !== "" && quickDraft.studentId !== ""
    && quickDraft.comment.trim() !== ""

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Évaluations & notes</h1>
        <p className="text-sm text-muted-foreground">
          Programmez vos évaluations, saisissez les résultats et validez les moyennes par période.
        </p>
      </header>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Contexte de travail</CardTitle>
          <CardDescription>Seules les classes présentes dans votre planning sont proposées.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
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
                {periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!scopeEnabled ? (
        <EmptyState title="Choisissez une classe et une période" description="Vos évaluations et vos élèves s’afficheront ici." />
      ) : scopeQuery.isLoading || studentsQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
      ) : scopeQuery.isError || studentsQuery.isError ? (
        <p className="text-sm text-destructive">Impossible de charger votre espace de notation pour cette classe.</p>
      ) : (
        <>
          {periodEnded ? (
            <Card className="border-destructive/30 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle>Période terminée</CardTitle>
                <CardDescription>
                  Les évaluations et les notes sont verrouillées. Vous pouvez encore passer au calcul puis valider les moyennes.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Note spontanée pendant le cours</CardTitle>
              <CardDescription>
                Attribuez rapidement un + ou un − à un élève. Le justificatif est obligatoire et la note compte dans la moyenne de la matière avec un coefficient 1.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_auto_2fr_auto] lg:items-end">
              <div className="space-y-2">
                <Label>Créneau</Label>
                <Select disabled={periodEnded} value={quickDraft.lessonSlotId || "none"} onValueChange={(value) => setQuickDraft((previous) => ({ ...previous, lessonSlotId: value === "none" ? "" : value }))}>
                  <SelectTrigger className="min-h-12" aria-label="Créneau"><SelectValue placeholder="Cours concerné" /></SelectTrigger>
                  <SelectContent>{(scopeQuery.data?.lessonSlots ?? []).map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>{dayLabel(slot.dayOfWeek)} {slot.startTime} · {slot.subjectName}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Élève</Label>
                <Select disabled={periodEnded} value={quickDraft.studentId || "none"} onValueChange={(value) => setQuickDraft((previous) => ({ ...previous, studentId: value === "none" ? "" : value }))}>
                  <SelectTrigger className="min-h-12" aria-label="Élève"><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
                  <SelectContent>{(studentsQuery.data?.data ?? []).map((student) => (
                    <SelectItem key={student.id} value={student.id}>{student.firstName} {student.lastName}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-2" aria-label="Appréciation spontanée">
                <Button type="button" disabled={periodEnded} variant={quickDraft.polarity === "positive" ? "default" : "outline"} className="min-h-12 min-w-12" aria-label="Note positive" onClick={() => setQuickDraft((previous) => ({ ...previous, polarity: "positive" }))}><Plus className="h-4 w-4" /></Button>
                <Button type="button" disabled={periodEnded} variant={quickDraft.polarity === "negative" ? "destructive" : "outline"} className="min-h-12 min-w-12" aria-label="Note négative" onClick={() => setQuickDraft((previous) => ({ ...previous, polarity: "negative" }))}><Minus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="spontaneous-comment">Justificatif</Label>
                <Input id="spontaneous-comment" disabled={periodEnded} value={quickDraft.comment} placeholder="Bonne réponse, participation, perturbation…" onChange={(event) => setQuickDraft((previous) => ({ ...previous, comment: event.target.value }))} />
              </div>
              <Button type="button" className="min-h-12" disabled={periodEnded || !canSaveSpontaneous || spontaneousMutation.isPending} onClick={() => spontaneousMutation.mutate()}>
                {spontaneousMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <div className="space-y-1"><CardTitle>Évaluations programmées</CardTitle><CardDescription>Le coefficient saisi ici pondère l’évaluation, indépendamment du coefficient de la matière.</CardDescription></div>
              <Button type="button" disabled={periodEnded} onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Nouvelle évaluation</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {scheduledEvaluations.length === 0 ? <EmptyState title="Aucune évaluation programmée" description="Créez une évaluation rattachée à l’un de vos créneaux." /> : scheduledEvaluations.map((evaluation) => (
                <EvaluationGradeEditor key={evaluation.id} evaluation={evaluation} students={studentsQuery.data?.data ?? []} readOnly={periodEnded} />
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle>Calcul et validation des moyennes</CardTitle><CardDescription>Les moyennes de cette période sont recalculées après chaque note. Validez une matière quand la saisie est terminée : elle devient alors disponible pour le suivi de l’administration et la préparation des bulletins.</CardDescription></CardHeader>
            <CardContent>
              {(scopeQuery.data?.completion.length ?? 0) === 0 ? <EmptyState title="Aucune matière assignée" description="Vérifiez que les matières de vos créneaux sont paramétrées pour le niveau." /> : (
                <Table><TableHeader><TableRow><TableHead>Matière</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
                  {(scopeQuery.data?.completion ?? []).map((subject) => <TableRow key={subject.subjectId}>
                    <TableCell className="font-medium">{subject.subjectName}</TableCell>
                    <TableCell>{subject.status === "completed" ? <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />Validée</Badge> : <Badge variant="secondary">{subject.calculationStarted ? "Calcul en cours" : "Saisie des notes"}</Badge>}</TableCell>
                    <TableCell className="text-right"><Button type="button" variant="outline" className="min-h-12" disabled={completionMutation.isPending || (periodEnded && subject.status === "completed")} onClick={() => completionMutation.mutate({ subjectId: subject.subjectId, status: !subject.calculationStarted ? "in_progress" : subject.status === "completed" ? "in_progress" : "completed" })}>{!subject.calculationStarted ? "Passer au calcul des moyennes" : subject.status === "completed" ? periodEnded ? "Moyennes validées" : "Rouvrir la saisie" : "Valider les moyennes"}</Button></TableCell>
                  </TableRow>)}
                </TableBody></Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Programmer une évaluation</DialogTitle></DialogHeader>
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
    </div>
  )
}

function EvaluationGradeEditor({ evaluation, students, readOnly }: { evaluation: EvaluationWithGrades; students: StudentItem[]; readOnly: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const gradeMutation = useMutation({
    mutationFn: (input: { studentId: string; score: number }) => upsertEvaluationGrade(evaluation.id, { studentId: input.studentId, score: input.score, maxScore: GRADE_MAX }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["evaluations-scope"] }); toast({ title: "Note enregistrée" }) },
    onError: (error) => toast({ title: "Enregistrement impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })
  return <div className="rounded-lg border p-4">
    <Button type="button" variant="ghost" className="min-h-12 w-full justify-between px-0 text-left" onClick={() => setOpen((value) => !value)}>
      <span><span className="block font-medium">{evaluation.label}</span><span className="text-xs text-muted-foreground">{evaluation.subjectName ?? "-"} · coef. évaluation {evaluation.coefficient}</span></span>
      <Badge variant="outline">{evaluation.grades.length} note(s)</Badge>
    </Button>
    {open ? <div className="mt-4 overflow-x-auto">{students.length === 0 ? <EmptyState title="Aucun élève actif" description="La classe ne contient aucun élève disponible pour la saisie." /> : <Table><TableHeader><TableRow><TableHead>Élève</TableHead><TableHead>Note / {GRADE_MAX}</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{students.map((student) => <GradeRow key={student.id} studentId={student.id} fullName={`${student.firstName} ${student.lastName}`} returnTo={`${location.pathname}${location.search}`} initialScore={String(evaluation.grades.find((item) => item.studentId === student.id)?.score ?? "")} readOnly={readOnly} onSave={(score) => gradeMutation.mutateAsync({ studentId: student.id, score })} />)}</TableBody></Table>}</div> : null}
  </div>
}

function GradeRow({ studentId, fullName, initialScore, onSave, returnTo, readOnly }: { studentId: string; fullName: string; initialScore: string; onSave: (score: number) => Promise<unknown>; returnTo: string; readOnly: boolean }) {
  const [score, setScore] = useState(initialScore)
  const parsed = Number(score.replace(",", "."))
  const valid = score !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= GRADE_MAX
  return <TableRow><TableCell className="font-medium">{fullName}</TableCell><TableCell><Input aria-label={`Note de ${fullName}`} disabled={readOnly} type="number" min={0} max={GRADE_MAX} step={0.25} className="max-w-24" value={score} onChange={(event) => setScore(event.target.value)} /></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="sm" className="min-h-12" asChild><Link to={`/academic/students/${studentId}/dossier`} state={{ from: returnTo }}>Dossier</Link></Button><Button type="button" size="sm" variant="outline" className="min-h-12" disabled={readOnly || !valid} onClick={() => void onSave(parsed)}>Enregistrer</Button></div></TableCell></TableRow>
}
