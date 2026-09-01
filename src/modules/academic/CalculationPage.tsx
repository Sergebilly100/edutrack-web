import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Loader2, PencilLine } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { listStudents, type StudentItem } from "@/modules/students/students.api"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  fetchEvaluationsScope,
  fetchTeacherAcademicContext,
  fetchTeacherConductScope,
  markSubjectCompleted,
  submitConductInput,
  type EvaluationWithGrades,
  type TeacherConductScopeItem,
} from "./academic.api"

const MAX_GRADE = 20

const subjectAverage = (evaluations: EvaluationWithGrades[], studentId: string): number | null => {
  const values = evaluations.filter((evaluation) => evaluation.type === "scheduled").flatMap((evaluation) => {
    const grade = evaluation.grades.find((item) => item.studentId === studentId)
    return grade ? [{ value: (grade.score / grade.maxScore) * MAX_GRADE, coefficient: evaluation.coefficient }] : []
  })
  if (values.length === 0) return null
  const denominator = values.reduce((total, value) => total + value.coefficient, 0)
  if (denominator <= 0) return null
  const baseAverage = values.reduce((total, value) => total + value.value * value.coefficient, 0) / denominator
  const adjustments = evaluations.filter((evaluation) => evaluation.type === "spontaneous").reduce((total, evaluation) => {
    const grade = evaluation.grades.find((item) => item.studentId === studentId)
    if (!grade) return total
    return total + (evaluation.label.startsWith("Note spontanée -") ? -grade.score : grade.score)
  }, 0)
  return Math.max(0, Math.min(MAX_GRADE, baseAverage + adjustments))
}

const formatAverage = (average: number | null) => average === null ? "—" : average.toFixed(2).replace(".", ",")

export default function CalculationPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const classId = searchParams.get("classId") ?? ""
  const gradingPeriodId = searchParams.get("gradingPeriodId") ?? ""
  const subjectId = searchParams.get("subjectId") ?? ""
  const [currentStep, setCurrentStep] = useState<2 | 3>(2)
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)
  const [conductStudentId, setConductStudentId] = useState<string | null>(null)

  const contextQuery = useQuery({ queryKey: ["academic", "teacher-context"], queryFn: fetchTeacherAcademicContext })
  const scopeQuery = useQuery({ queryKey: ["evaluations-scope", classId, gradingPeriodId], queryFn: () => fetchEvaluationsScope(classId, gradingPeriodId), enabled: Boolean(classId) && Boolean(gradingPeriodId) })
  const studentsQuery = useQuery({ queryKey: ["students-list", classId], queryFn: () => listStudents({ classId, isActive: true, limit: 100 }), enabled: Boolean(classId) })
  const conductQuery = useQuery({ queryKey: ["conduct-input-scope", classId, gradingPeriodId], queryFn: () => fetchTeacherConductScope(classId, gradingPeriodId), enabled: Boolean(classId) && Boolean(gradingPeriodId) })

  const subject = scopeQuery.data?.subjects.find((item) => item.id === subjectId)
  const completion = scopeQuery.data?.completion.find((item) => item.subjectId === subjectId)
  const selectedClass = contextQuery.data?.classes.find((item) => item.id === classId)
  const period = contextQuery.data?.gradingPeriods.find((item) => item.id === gradingPeriodId)
  const evaluations = useMemo(() => (scopeQuery.data?.evaluations ?? []).filter((item) => item.subjectId === subjectId), [scopeQuery.data?.evaluations, subjectId])
  const conductByStudent = new Map((conductQuery.data?.students ?? []).map((item) => [item.studentId, item.input]))
  const conductStudent = (studentsQuery.data?.data ?? []).find((student) => student.id === conductStudentId) ?? null
  const conductEntry = (conductQuery.data?.students ?? []).find((item) => item.studentId === conductStudentId) ?? null

  const invalidateCalculation = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["evaluations-scope", classId, gradingPeriodId] }),
      queryClient.invalidateQueries({ queryKey: ["conduct-input-scope", classId, gradingPeriodId] }),
    ])
  }
  const validateMutation = useMutation({
    mutationFn: () => markSubjectCompleted({ classId, subjectId, gradingPeriodId, status: "completed" }),
    onSuccess: async () => { await invalidateCalculation(); toast({ title: "Moyennes validées et transmises à l’administration" }) },
    onError: (error) => toast({ title: "Validation impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })

  if (!classId || !gradingPeriodId || !subjectId) return <EmptyState title="Calcul non défini" description="Revenez à Évaluations & notes puis choisissez une matière à calculer." action={{ label: "Retour aux évaluations", onClick: () => navigate("/academic/notes") }} />
  if (scopeQuery.isLoading || studentsQuery.isLoading || conductQuery.isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement du calcul…</p>
  if (scopeQuery.isError || studentsQuery.isError || conductQuery.isError || !subject || !completion) return <EmptyState title="Calcul indisponible" description="Vérifiez la classe, la matière et la période choisies depuis Évaluations & notes." action={{ label: "Retour aux évaluations", onClick: () => navigate("/academic/notes") }} />
  if (!completion.calculationStarted) return <EmptyState title="Saisie encore ouverte" description="Clôturez d’abord la saisie de cette matière depuis Évaluations & notes." action={{ label: "Retour aux évaluations", onClick: () => navigate(`/academic/notes?classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(gradingPeriodId)}`) }} />

  const students = studentsQuery.data?.data ?? []
  const editable = completion.status !== "completed" && period?.isCurrent !== false && conductQuery.data?.isAvailable === true
  const saveConduct = async (studentId: string, note: number, observation?: string) => {
    await submitConductInput({ student_id: studentId, grading_period_id: gradingPeriodId, note, observation })
    await invalidateCalculation()
    toast({ title: "Note de conduite enregistrée" })
  }

  return <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
    <header className="space-y-3">
      <Button variant="ghost" className="min-h-12 px-0" asChild><Link to={`/academic/notes?classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(gradingPeriodId)}`}><ArrowLeft className="mr-2 h-4 w-4" />Retour aux évaluations</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Calcul des moyennes</h1><p className="text-sm text-muted-foreground">{selectedClass?.name ?? "Classe"} · {subject.name} · {period?.label ?? "Période"}</p></div><Badge variant={completion.status === "completed" ? "outline" : "secondary"}>{completion.status === "completed" ? "Moyennes validées" : "Saisie clôturée"}</Badge></div>
    </header>

    <ol className="grid grid-cols-3 gap-2 text-center text-sm" aria-label="Étapes de calcul"><li className="rounded-lg border p-3 text-muted-foreground">1. Notes terminées</li><li className={currentStep === 2 ? "rounded-lg bg-primary p-3 font-medium text-primary-foreground" : "rounded-lg border p-3 text-muted-foreground"}>2. Notes par élève</li><li className={currentStep === 3 ? "rounded-lg bg-primary p-3 font-medium text-primary-foreground" : "rounded-lg border p-3 text-muted-foreground"}>3. Moyennes</li></ol>

    {completion.status === "completed" || period?.isCurrent === false ? <Card className="shadow-sm"><CardContent className="flex gap-3 p-4 text-sm"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />{period?.isCurrent === false ? "Cette période est consultable uniquement. Les données ne redeviennent jamais modifiables après la génération des bulletins." : "Cette matière est validée pour cette classe et cette période. Les notes et la conduite associée sont verrouillées."}</CardContent></Card> : null}

    {currentStep === 2 ? <Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle>Notes de {subject.name}</CardTitle><CardDescription>Vérifiez le nombre de notes de chaque élève. Ouvrez le détail pour consulter les évaluations, puis renseignez la conduite individuellement.</CardDescription></CardHeader><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Élève</TableHead><TableHead>Notes</TableHead><TableHead>Conduite</TableHead><TableHead className="text-right">Détail</TableHead></TableRow></TableHeader><TableBody>{students.map((student) => <StudentNotesRows key={student.id} student={student} evaluations={evaluations} conduct={conductByStudent.get(student.id) ?? null} editable={editable} expanded={expandedStudentId === student.id} onExpand={() => setExpandedStudentId((current) => current === student.id ? null : student.id)} onEditConduct={() => setConductStudentId(student.id)} />)}</TableBody></Table></CardContent></Card> : <Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle>Moyennes de {subject.name}</CardTitle><CardDescription>Consultez les moyennes par élève avant la validation définitive de cette matière.</CardDescription></CardHeader><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Élève</TableHead><TableHead>Moyenne / 20</TableHead><TableHead>Conduite / 20</TableHead></TableRow></TableHeader><TableBody>{students.map((student) => <TableRow key={student.id}><TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell><TableCell className="font-medium">{formatAverage(subjectAverage(evaluations, student.id))}</TableCell><TableCell>{conductByStudent.get(student.id)?.note ?? "—"}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}

    {editable && currentStep === 2 ? <Button type="button" className="min-h-12 w-full" onClick={() => setCurrentStep(3)}>Voir les moyennes par élève</Button> : null}
    {editable && currentStep === 3 ? <div className="sticky bottom-0 space-y-2 border-t bg-background/95 py-3"><Button type="button" variant="outline" className="min-h-12 w-full" onClick={() => setCurrentStep(2)}>Revenir aux notes par élève</Button><Button type="button" className="min-h-12 w-full" disabled={validateMutation.isPending} onClick={() => validateMutation.mutate()}>{validateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Valider mes moyennes de {subject.name}</Button><p className="text-center text-xs text-muted-foreground">Après validation, les notes de cette matière ne seront plus modifiables.</p></div> : null}

    <ConductGradeDialog student={conductStudent} conductEntry={conductEntry} editable={editable} onOpenChange={(open) => !open && setConductStudentId(null)} onSave={saveConduct} />
  </div>
}

function StudentNotesRows({ student, evaluations, conduct, editable, expanded, onExpand, onEditConduct }: { student: StudentItem; evaluations: EvaluationWithGrades[]; conduct: { note: number; observation: string | null; createdAt: string } | null; editable: boolean; expanded: boolean; onExpand: () => void; onEditConduct: () => void }) {
  const fullName = `${student.firstName} ${student.lastName}`
  const scheduled = evaluations.filter((evaluation) => evaluation.type === "scheduled").flatMap((evaluation) => evaluation.grades.filter((grade) => grade.studentId === student.id).map((grade) => ({ label: evaluation.label, coefficient: evaluation.coefficient, ...grade })))
  const spontaneous = evaluations.filter((evaluation) => evaluation.type === "spontaneous").flatMap((evaluation) => evaluation.grades.filter((grade) => grade.studentId === student.id).map((grade) => ({ label: evaluation.label, ...grade, score: evaluation.label.startsWith("Note spontanée -") ? -grade.score : grade.score })))
  return <><TableRow><TableCell className="font-medium">{fullName}</TableCell><TableCell>{scheduled.length} note{scheduled.length > 1 ? "s" : ""}</TableCell><TableCell><div className="flex min-w-[150px] items-center gap-2"><span>{conduct?.note ?? "—"}</span>{editable ? <Button type="button" variant="outline" className="min-h-12" onClick={onEditConduct}><PencilLine className="mr-2 h-4 w-4" />{conduct ? "Modifier" : "Saisir"}</Button> : null}</div></TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" className="min-h-12 min-w-12" aria-label={`Détails de ${fullName}`} onClick={onExpand}>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></TableCell></TableRow>{expanded ? <TableRow><TableCell colSpan={4} className="bg-muted/30"><div className="grid gap-4 py-2 md:grid-cols-2"><div><p className="mb-2 text-sm font-medium">Évaluations</p>{scheduled.length === 0 ? <p className="text-sm text-muted-foreground">Aucune note d’évaluation.</p> : <ul className="space-y-1 text-sm">{scheduled.map((item) => <li key={`${item.label}-${item.score}`}>{item.label} · {item.score}/{item.maxScore} · coef. {item.coefficient}</li>)}</ul>}</div><div><p className="mb-2 text-sm font-medium">Notes spontanées</p>{spontaneous.length === 0 ? <p className="text-sm text-muted-foreground">Aucune note spontanée.</p> : <ul className="space-y-2 text-sm">{spontaneous.map((item) => <li key={`${item.label}-${item.score}-${item.comment ?? ""}`}><span className={item.score > 0 ? "font-medium text-green-700" : "font-medium text-red-700"}>{item.score > 0 ? "+" : "−"}{Math.abs(item.score)}</span><span className="text-muted-foreground"> · {item.label}</span>{item.comment ? <span className="block text-muted-foreground">Justificatif : {item.comment}</span> : null}</li>)}</ul>}</div></div>{conduct?.observation ? <p className="mt-3 text-sm text-muted-foreground">Observation de conduite : {conduct.observation}</p> : null}</TableCell></TableRow> : null}</>
}

function ConductGradeDialog({ student, conductEntry, editable, onOpenChange, onSave }: { student: StudentItem | null; conductEntry: TeacherConductScopeItem | null; editable: boolean; onOpenChange: (open: boolean) => void; onSave: (studentId: string, note: number, observation?: string) => Promise<void> }) {
  const [note, setNote] = useState("")
  const [observation, setObservation] = useState("")
  const [saving, setSaving] = useState(false)
  useEffect(() => { setNote(conductEntry?.input ? String(conductEntry.input.note) : ""); setObservation(conductEntry?.input?.observation ?? "") }, [conductEntry?.input?.createdAt, conductEntry?.input?.note, conductEntry?.input?.observation, student?.id])
  const parsed = Number(note.replace(",", "."))
  const canSave = editable && note !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_GRADE
  const save = async () => {
    if (!student || !canSave) return
    setSaving(true)
    try { await onSave(student.id, parsed, observation.trim() || undefined); onOpenChange(false) } finally { setSaving(false) }
  }
  return <Dialog open={Boolean(student)} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-xl overflow-y-auto rounded-lg p-0 sm:w-full"><DialogHeader className="border-b px-5 py-5 text-left sm:px-6"><DialogTitle>Conduite de {student ? `${student.firstName} ${student.lastName}` : "l’élève"}</DialogTitle><DialogDescription>Cette note reste modifiable jusqu’à la validation des moyennes.</DialogDescription></DialogHeader><div className="space-y-4 px-5 py-5 sm:px-6"><div className="space-y-2"><Label htmlFor="conduct-note">Note / 20</Label><Input id="conduct-note" type="number" min={0} max={MAX_GRADE} step={0.5} disabled={!editable} value={note} onChange={(event) => setNote(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="conduct-observation">Observation</Label><Input id="conduct-observation" disabled={!editable} value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Optionnel" /></div></div><DialogFooter className="border-t px-5 py-4 sm:px-6"><Button type="button" variant="outline" className="min-h-12" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button><Button type="button" className="min-h-12" disabled={!canSave || saving} onClick={() => void save()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{saving ? "Enregistrement…" : "Enregistrer"}</Button></DialogFooter></DialogContent></Dialog>
}
