import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Loader2, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  createEvaluation,
  dayLabel,
  fetchClassCompletion,
  fetchEvaluationsScope,
  listClasses,
  markSubjectCompleted,
  upsertEvaluationGrade,
  type EvaluationWithGrades,
} from "./academic.api"
import { listStudents } from "@/modules/students/students.api"

const GRADE_MAX = 20

export default function NotesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [classId, setClassId] = useState("")
  const [gradingPeriodId, setGradingPeriodId] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState({
    label: "",
    lessonSlotId: "",
    subjectId: "",
    type: "scheduled" as "scheduled" | "spontaneous",
    coefficient: "1",
  })

  const classesQuery = useQuery({
    queryKey: ["academic", "classes-for-notes"],
    queryFn: () => listClasses(),
  })
  const periodsQuery = useQuery({
    queryKey: ["academic", "grading-periods"],
    queryFn: async () => {
      const { apiClient } = await import("@/shared/api/client")
      return apiClient
        .get<{ gradingPeriods: Array<{ id: string; label: string }> }>("/grading-periods")
        .then((r) => r.data.gradingPeriods)
    },
  })

  const scopeEnabled = Boolean(classId) && Boolean(gradingPeriodId)
  const scopeQuery = useQuery({
    queryKey: ["evaluations-scope", classId, gradingPeriodId],
    queryFn: () => fetchEvaluationsScope(classId, gradingPeriodId),
    enabled: scopeEnabled,
  })
  const completionQuery = useQuery({
    queryKey: ["class-completion", classId, gradingPeriodId],
    queryFn: () => fetchClassCompletion(classId, gradingPeriodId),
    enabled: scopeEnabled,
  })

  const invalidate = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["evaluations-scope", classId, gradingPeriodId] }),
      queryClient.invalidateQueries({ queryKey: ["class-completion", classId, gradingPeriodId] }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createEvaluation({
        lessonSlotId: draft.lessonSlotId,
        subjectId: draft.subjectId,
        classId,
        gradingPeriodId,
        type: draft.type,
        coefficient: Number(draft.coefficient) > 0 ? Number(draft.coefficient) : 1,
        label: draft.label.trim(),
      }),
    onSuccess: async () => {
      await invalidate()
      setCreateOpen(false)
      setDraft({ label: "", lessonSlotId: "", subjectId: "", type: "scheduled", coefficient: "1" })
      toast({ title: "Évaluation créée" })
    },
    onError: (error) => {
      toast({
        title: "Création impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    },
  })

  const completionMutation = useMutation({
    mutationFn: (input: { subjectId: string; status: "in_progress" | "completed" }) =>
      markSubjectCompleted({
        classId,
        subjectId: input.subjectId,
        gradingPeriodId,
        status: input.status,
      }),
    onSuccess: async (_data, variables) => {
      await invalidate()
      toast({ title: variables.status === "completed" ? "Matière marquée terminée" : "Matière réouverte" })
    },
    onError: (error) => {
      toast({
        title: "Mise à jour impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    },
  })

  const canSubmitCreate =
    draft.label.trim().length > 0 && Boolean(draft.lessonSlotId) && Boolean(draft.subjectId)

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Saisie des notes</h1>
        <p className="text-sm text-muted-foreground">
          Évaluations rattachées à vos créneaux de cours, notes par élève et complétude par matière.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Classe</Label>
          <Select value={classId || "none"} onValueChange={(value) => setClassId(value === "none" ? "" : value)}>
            <SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
            <SelectContent>
              {(classesQuery.data?.classes ?? []).map((klass) => (
                <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Période d&apos;évaluation</Label>
          <Select
            value={gradingPeriodId || "none"}
            onValueChange={(value) => setGradingPeriodId(value === "none" ? "" : value)}
          >
            <SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir une période" /></SelectTrigger>
            <SelectContent>
              {(periodsQuery.data ?? []).map((period) => (
                <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!scopeEnabled ? (
        <EmptyState
          title="Choisissez une classe et une période"
          description="Vos évaluations et la complétude s'afficheront ici."
        />
      ) : scopeQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </p>
      ) : scopeQuery.isError ? (
        <p className="text-sm text-red-600">Impossible de charger vos évaluations pour cette classe.</p>
      ) : (
        <>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-1">
                <CardTitle>Mes évaluations</CardTitle>
                <CardDescription>Saisie élève par élève, sur {GRADE_MAX}.</CardDescription>
              </div>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nouvelle évaluation
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {(scopeQuery.data?.evaluations.length ?? 0) === 0 ? (
                <EmptyState
                  title="Aucune évaluation"
                  description="Créez une première évaluation rattachée à un créneau de cours."
                />
              ) : (
                scopeQuery.data!.evaluations.map((evaluation) => (
                  <EvaluationGradeEditor key={evaluation.id} evaluation={evaluation} classId={classId} />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Complétude par matière</CardTitle>
              <CardDescription>
                Marquez une matière terminée quand toutes ses notes sont saisies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(completionQuery.data?.subjects.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune matière paramétrée pour ce niveau.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matière</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(completionQuery.data?.subjects ?? []).map((subject) => (
                      <TableRow key={subject.subjectId}>
                        <TableCell className="font-medium">{subject.subjectName}</TableCell>
                        <TableCell>
                          {subject.status === "completed" ? (
                            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Terminée
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                              En cours
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-10"
                            disabled={completionMutation.isPending}
                            onClick={() =>
                              completionMutation.mutate({
                                subjectId: subject.subjectId,
                                status: subject.status === "completed" ? "in_progress" : "completed",
                              })
                            }
                          >
                            {subject.status === "completed" ? "Rouvrir" : "Marquer terminée"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle évaluation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Créneau de cours</Label>
              <Select
                value={draft.lessonSlotId || "none"}
                onValueChange={(value) => {
                  const slot = scopeQuery.data?.lessonSlots.find((item) => item.id === value)
                  const matchingSubject = scopeQuery.data?.subjects.find(
                    (subject) =>
                      slot &&
                      subject.name.localeCompare(slot.subjectName, "fr", { sensitivity: "base" }) === 0
                  )
                  setDraft((prev) => ({
                    ...prev,
                    lessonSlotId: value === "none" ? "" : value,
                    subjectId: matchingSubject?.id ?? prev.subjectId,
                  }))
                }}
              >
                <SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir un créneau" /></SelectTrigger>
                <SelectContent>
                  {(scopeQuery.data?.lessonSlots ?? []).map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {dayLabel(slot.dayOfWeek)} {slot.startTime}-{slot.endTime} · {slot.subjectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Matière</Label>
              <Select
                value={draft.subjectId || "none"}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, subjectId: value === "none" ? "" : value }))}
              >
                <SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir une matière" /></SelectTrigger>
                <SelectContent>
                  {(scopeQuery.data?.subjects ?? []).map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name} (coef. {subject.coefficient})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={draft.type}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value as "scheduled" | "spontaneous" }))}
                >
                  <SelectTrigger className="min-h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Programmée</SelectItem>
                    <SelectItem value="spontaneous">Spontanée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Coefficient</Label>
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={draft.coefficient}
                  onChange={(event) => setDraft((prev) => ({ ...prev, coefficient: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Libellé</Label>
              <Input
                placeholder="Devoir surveillé n°1"
                value={draft.label}
                onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={!canSubmitCreate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Créer l&apos;évaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EvaluationGradeEditor({
  evaluation,
  classId,
}: {
  evaluation: EvaluationWithGrades
  classId: string
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const studentsQuery = useQuery({
    queryKey: ["students-list", classId],
    queryFn: () => listStudents({ classId, isActive: true, limit: 200 }),
    enabled: open,
  })

  const gradeMutation = useMutation({
    mutationFn: (input: { studentId: string; score: number }) =>
      upsertEvaluationGrade(evaluation.id, {
        studentId: input.studentId,
        score: input.score,
        maxScore: GRADE_MAX,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["evaluations-scope"] })
      toast({ title: "Note enregistrée", duration: 3000 })
    },
    onError: (error) => {
      toast({
        title: "Enregistrement impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
        duration: 6000,
      })
    },
  })

  return (
    <div className="rounded-lg border p-4">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="block font-medium">{evaluation.label}</span>
          <span className="text-xs text-muted-foreground">
            {evaluation.subjectName ?? "-"} · coef. {evaluation.coefficient}
            {evaluation.type === "spontaneous" ? " · spontanée" : ""}
          </span>
        </span>
        <Badge variant="outline">{evaluation.grades.length} note(s)</Badge>
      </button>

      {open ? (
        <div className="mt-4 overflow-x-auto">
          {studentsQuery.isLoading ? (
            <p className="py-2 text-sm text-muted-foreground">Chargement des élèves…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Note / {GRADE_MAX}</TableHead>
                  <TableHead className="text-right">&nbsp;</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(studentsQuery.data?.data ?? []).map((student) => (
                  <GradeRow
                    key={student.id}
                    fullName={`${student.firstName} ${student.lastName}`}
                    initialScore={
                      String(
                        evaluation.grades.find((item) => item.studentId === student.id)?.score ?? ""
                      )
                    }
                    onSave={(score) =>
                      gradeMutation.mutateAsync({ studentId: student.id, score })
                    }
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ) : null}
    </div>
  )
}

function GradeRow({
  fullName,
  initialScore,
  onSave,
}: {
  fullName: string
  initialScore: string
  onSave: (score: number) => Promise<unknown>
}) {
  const [score, setScore] = useState(initialScore)
  const parsed = Number(score.replace(",", "."))
  const valid = score !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= GRADE_MAX

  return (
    <TableRow>
      <TableCell className="font-medium">{fullName}</TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          max={GRADE_MAX}
          step={0.25}
          className="max-w-24"
          value={score}
          onChange={(event) => setScore(event.target.value)}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10"
          disabled={!valid}
          onClick={() => void onSave(parsed)}
        >
          Enregistrer
        </Button>
      </TableCell>
    </TableRow>
  )
}
