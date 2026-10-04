import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, CalendarPlus, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { listStudents, type StudentItem } from "@/modules/students/students.api"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  createEvaluation,
  dayLabel,
  fetchEvaluationsScope,
  fetchTeacherAcademicContext,
  markSubjectCompleted,
  upsertEvaluationGrade,
  type EvaluationWithGrades,
} from "./academic.api"
import { invalidateAcademicReportScope } from "./academic-report-cache"

const GRADE_MAX = 20
const formatEvaluationDate = (value: string | null) => value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`)) : "-"
const isForbidden = (error: unknown) => typeof error === "object" && error !== null && "status" in error && error.status === 403

function NotesLoadError({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-2">
    <span>{message}</span>
    <Button type="button" variant="outline" className="min-h-12" onClick={onRetry}>{retryLabel}</Button>
  </AlertDescription></Alert>
}

export default function NotesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "")
  const [selectedPeriodId, setSelectedPeriodId] = useState(searchParams.get("gradingPeriodId") ?? "")
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingCalculationSubjectId, setPendingCalculationSubjectId] = useState<string | null>(null)
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ label: "", lessonSlotId: "", subjectId: "", coefficient: "1", evaluationDate: "" })

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
  const gradingPeriodId = selectedPeriodId
    || periods.find((period) => period.notesEntryOpen && today >= period.startDate && today <= period.endDate)?.id
    || periods.find((period) => period.notesEntryOpen)?.id || ""
  const activePeriod = periods.find((period) => period.id === gradingPeriodId)
  const isPeriodReadOnly = Boolean(activePeriod?.isCompleted || activePeriod?.closedClassIds?.includes(classId))

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
  const invalidateScope = () => invalidateAcademicReportScope(queryClient, classId, gradingPeriodId)

  const createMutation = useMutation({
    mutationFn: () => createEvaluation({
      ...(draft.lessonSlotId ? { lessonSlotId: draft.lessonSlotId } : {}),
      subjectId: draft.subjectId,
      classId,
      gradingPeriodId,
      type: "scheduled",
      coefficient: Number(draft.coefficient),
      label: draft.label.trim(),
      evaluationDate: draft.evaluationDate,
    }),
    onSuccess: async () => {
      await invalidateScope()
      setCreateOpen(false)
      setDraft({ label: "", lessonSlotId: "", subjectId: "", coefficient: "1", evaluationDate: "" })
      toast({ title: "Évaluation programmée" })
    },
    onError: (error) => toast({
      title: "Création impossible",
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
  const hasEnteredScheduledGrade = scheduledEvaluations.some((evaluation) => evaluation.grades.length > 0)
  const scheduledCountBySubject = new Map<string, number>()
  for (const evaluation of scheduledEvaluations) {
    if (evaluation.subjectId) scheduledCountBySubject.set(evaluation.subjectId, (scheduledCountBySubject.get(evaluation.subjectId) ?? 0) + 1)
  }
  const completionBySubject = new Map((scopeQuery.data?.completion ?? []).map((item) => [item.subjectId, item]))
  const correctionBySubject = new Map((scopeQuery.data?.correctionStatuses ?? []).map((item) => [item.subjectId, item.status]))
  const isSubjectClosed = (subjectId: string | null | undefined) =>
    isPeriodReadOnly || completionBySubject.get(subjectId ?? "")?.status === "completed"
  const isSubjectReadyForCalculation = (subjectId: string) =>
    scheduledEvaluations.some((evaluation) => evaluation.subjectId === subjectId)
  const selectedDraftSlot = scopeQuery.data?.lessonSlots.find((item) => item.id === draft.lessonSlotId)
  const availableDraftSubjects = selectedDraftSlot?.subjectId
    ? (scopeQuery.data?.subjects ?? []).filter((item) => item.id === selectedDraftSlot.subjectId)
    : (scopeQuery.data?.subjects ?? [])
  const nextPeriod = periods
    .filter((period) => activePeriod && period.startDate > activePeriod.startDate)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))[0]
  const draftSubjectIsLocked = completionBySubject.get(draft.subjectId)?.status === "completed"
  const canCreate = draft.label.trim() !== "" && draft.subjectId !== "" && draft.evaluationDate !== ""
    && !isPeriodReadOnly && !draftSubjectIsLocked
    && Boolean(activePeriod && draft.evaluationDate >= activePeriod.startDate && draft.evaluationDate <= activePeriod.endDate)
    && Number.isFinite(Number(draft.coefficient)) && Number(draft.coefficient) > 0
  const selectedEvaluation = scheduledEvaluations.find((evaluation) => evaluation.id === selectedEvaluationId) ?? null
  const pendingCalculationSubject = (scopeQuery.data?.completion ?? []).find(
    (subject) => subject.subjectId === pendingCalculationSubjectId,
  )

  return (
    <> 
      <div className="space-y-4">

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-1">

            <h1 className="text-2xl font-semibold tracking-tight">
              Évaluations & notes
            </h1>
            <p className="text-sm text-muted-foreground">
              Préparez, notez et validez vos matières pour une classe et une
              période précises.
            </p>
          </div>
        </header>

        <section
          aria-label="Contexte de notation"
          className="rounded-lg border bg-card p-3 shadow-sm md:p-5"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-semibold">Classe et période</h2>
              <p className="text-xs text-muted-foreground">
                Toutes les actions ci-dessous concernent cette sélection.
              </p>
            </div>
            {selectedClass && gradingPeriodId ? (
              <Badge variant={isPeriodReadOnly ? "outline" : "secondary"}>
                {selectedClass.name} · {activePeriod?.label}
                {isPeriodReadOnly ? " · lecture seule" : " · en cours"}
              </Badge>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Classe enseignée</Label>
              <Select
                value={classId || "none"}
                onValueChange={(value) => {
                  setClassId(value === "none" ? "" : value);
                  setSelectedPeriodId("");
                }}
              >
                <SelectTrigger className="min-h-6" aria-label="Classe enseignée">
                  <SelectValue placeholder="Choisir une classe" />
                </SelectTrigger>
                <SelectContent>
                  {(contextQuery.data?.classes ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} · {item.levelName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contextQuery.isError ? (
                <p className="text-sm text-destructive">
                  Impossible de charger vos classes.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Période de calcul</Label>
              <Select
                value={gradingPeriodId || "none"}
                onValueChange={(value) =>
                  setSelectedPeriodId(value === "none" ? "" : value)
                }
              >
                <SelectTrigger className="min-h-6" aria-label="Période de calcul">
                  <SelectValue placeholder="Choisir une période" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.id} value={period.id} disabled={!period.notesEntryOpen && !period.conductReviewOpen && !period.isClosed}>
                      {period.label}
                      {period.notesEntryOpen
                        ? " · en cours"
                        : period.conductReviewOpen
                          ? " · en revue"
                          : period.isClosed
                            ? " · finalisée"
                            : " · à venir"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {scopeEnabled ? (
            <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                className="min-h-5 sm:flex-1"
                disabled={isPeriodReadOnly}
                onClick={() => setCreateOpen(true)}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                Programmer une évaluation
              </Button>
            </div>
          ) : null}
        </section>

        {!scopeEnabled ? (
          <EmptyState
            title="Choisissez une classe et une période"
            description="Vos évaluations et vos élèves s’afficheront ici."
            classNameRendu="py-0"
          />
        ) : scopeQuery.isLoading || studentsQuery.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : scopeQuery.isError || studentsQuery.isError ? (
          <div className="space-y-2">
            {scopeQuery.isError ? <NotesLoadError
              message={isForbidden(scopeQuery.error) ? "Cette classe n’est plus dans votre périmètre de notation. Vérifiez vos affectations ou votre EDT." : "Impossible de charger les évaluations de cette classe."}
              retryLabel="Réessayer les évaluations"
              onRetry={() => void scopeQuery.refetch()}
            /> : null}
            {studentsQuery.isError ? <NotesLoadError
              message={isForbidden(studentsQuery.error) ? "L’accès aux élèves de cette classe est refusé. Vérifiez vos affectations ou votre EDT." : "Impossible de charger les élèves de cette classe."}
              retryLabel="Réessayer les élèves"
              onRetry={() => void studentsQuery.refetch()}
            /> : null}
          </div>
        ) : (
          <>
            {isPeriodReadOnly ? (
              <div className="rounded-lg border border-muted-foreground/20 bg-muted/40 p-4 text-sm text-muted-foreground">
                Cette classe et cette période sont clôturées. Les notes restent consultables.
              </div>
            ) : null}
            <section
              aria-labelledby="evaluations-title"
              className="space-y-4 rounded-lg border bg-card p-2 shadow-sm md:p-5"
            >
              <div className="mb-2 flex gap-2 border-b pb-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <CalendarPlus className="h-4 w-4" />
                </span>
                <div className="space-y-2 !mt-0">
                  <h2 id="evaluations-title" className="font-semibold">
                    Évaluations programmées
                    <Badge variant="outline" className="ml-3">
                      {scheduledEvaluations.length}
                      {/* prévue{scheduledEvaluations.length > 1 ? "s" : ""} */}
                    </Badge>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Le coefficient pondère cette évaluation, sans modifier celui
                    de la matière.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {scheduledEvaluations.length === 0 ? (
                  <EmptyState
                    title="Aucune évaluation programmée"
                    description=""
                    classNameRendu="py-0"
                    icon="none"
                  />
                ) : (
                  scheduledEvaluations.map((evaluation) => (
                    <EvaluationGradeEditor
                      key={evaluation.id}
                      evaluation={evaluation}
                      students={studentsQuery.data?.data ?? []}
                      readOnly={isSubjectClosed(evaluation.subjectId)}
                      onOpen={() => setSelectedEvaluationId(evaluation.id)}
                    />
                  ))
                )}
              </div>
            </section>

            {hasEnteredScheduledGrade ? (
              <section
                aria-labelledby="calculation-title"
                className="rounded-lg border bg-card p-2 shadow-sm md:p-5"
              >
                <div className="mb-2 flex gap-2 border-b pb-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <ClipboardCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 id="calculation-title" className="font-semibold">
                      Calculer et valider par matière
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Calculez les moyennes dès qu’une évaluation existe. Les notes
                      restent modifiables jusqu’à la validation définitive.
                    </p>
                  </div>
                </div>
                <div>
                  {(scopeQuery.data?.completion.length ?? 0) === 0 ? (
                    <EmptyState
                      title="Aucune matière à clôturer"
                      description=""
                      classNameRendu="py-0"
                      icon="none"
                    />
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {(scopeQuery.data?.completion ?? []).map((subject) => {
                        const count =
                          scheduledCountBySubject.get(subject.subjectId) ?? 0;
                        const readyForCalculation = isSubjectReadyForCalculation(subject.subjectId)
                        const actionLabel =
                          subject.status === "completed"
                            ? "Consulter les moyennes"
                            : subject.calculationStarted
                              ? "Ouvrir le calcul"
                              : "Calculer les moyennes";
                        return (
                          <div
                            key={subject.subjectId}
                            className="flex flex-col gap-2 p-2 flex-row justify-between"
                          >
                            <div className="inline-flex whitespace-nowrap justify-between gap-2 min-w-0">
                              <p className="font-medium">{subject.subjectName}
                                <span className="text-sm  text-muted-foreground"> ({count} évaluation{count > 1 ? "s" : ""}) </span>
                              </p>
                              <span>
                                {subject.status === "completed" ? (
                                  <Badge variant="outline">
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Validée
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">
                                    {subject.calculationStarted
                                      ? "Moyennes calculées, modifiables"
                                      : "Saisie en cours"}
                                  </Badge>
                                )}
                              </span>
                              {correctionBySubject.has(subject.subjectId) ? <Badge variant="outline">Réclamation : {correctionBySubject.get(subject.subjectId) === "approved" ? "correction ouverte" : correctionBySubject.get(subject.subjectId) === "corrected" ? "matière revalidée" : "en traitement"}</Badge> : null}
                            </div>
                            <div className="flex flex-col gap-2 sm:items-end">

                              <Button
                                type="button"
                                variant={
                                  subject.calculationStarted ? "outline" : "default"
                                }
                                className="min-h-6 w-full sm:w-auto"
                                disabled={
                                  completionMutation.isPending ||
                                  (!subject.calculationStarted && !readyForCalculation) ||
                                  (isPeriodReadOnly && !subject.calculationStarted)
                                }
                                onClick={() =>
                                  subject.calculationStarted
                                    ? navigate(
                                        `/academic/calculation?classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(gradingPeriodId)}&subjectId=${encodeURIComponent(subject.subjectId)}`,
                                      )
                                    : setPendingCalculationSubjectId(subject.subjectId)
                                }
                              >
                                {actionLabel}
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                              {!subject.calculationStarted && !readyForCalculation ? (
                                <p className="text-right text-xs text-muted-foreground">
                                  Ajoutez au moins une évaluation.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            ) : null}
          </>
        )}

        <AlertDialog
          open={Boolean(pendingCalculationSubjectId)}
          onOpenChange={(open) => !open && setPendingCalculationSubjectId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Passer au calcul des moyennes ?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  Les moyennes de {pendingCalculationSubject?.subjectName ?? "cette matière"} seront calculées pour {activePeriod?.label ?? "cette période"}. Vous pourrez encore modifier les notes jusqu’à la validation définitive.
                </span>
                <span className="block">
                  {nextPeriod
                    ? `Pour programmer les prochaines évaluations de cette matière, sélectionnez explicitement ${nextPeriod.label} lorsqu’elle sera ouverte à la saisie.`
                    : "Aucune période suivante n’est configurée pour les prochaines évaluations de cette matière."}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                disabled={completionMutation.isPending}
                onClick={() => {
                  if (!pendingCalculationSubjectId) return
                  completionMutation.mutate({
                    subjectId: pendingCalculationSubjectId,
                    status: "in_progress",
                  })
                  setPendingCalculationSubjectId(null)
                }}
              >
                {completionMutation.isPending ? "Calcul…" : "Calculer les moyennes"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-xl overflow-y-auto rounded-lg sm:w-full">
            <DialogHeader>
              <DialogTitle>Programmer une évaluation</DialogTitle>
              <DialogDescription>
                Choisissez la matière et la date. Le créneau EDT reste facultatif.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Créneau de cours (facultatif)</Label>
                <Select
                  value={draft.lessonSlotId || "none"}
                  onValueChange={(value) => {
                    const slot = scopeQuery.data?.lessonSlots.find(
                      (item) => item.id === value,
                    );
                    setDraft((previous) => ({
                      ...previous,
                      lessonSlotId: value === "none" ? "" : value,
                      subjectId: slot?.subjectId ?? previous.subjectId,
                    }));
                  }}
                >
                  <SelectTrigger className="min-h-6">
                    <SelectValue placeholder="Aucun créneau EDT" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun créneau - EDT non configuré</SelectItem>
                    {(scopeQuery.data?.lessonSlots ?? []).map((slot) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {dayLabel(slot.dayOfWeek)} · {slot.startTime}-
                        {slot.endTime} · {slot.roomName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Matière</Label>
                <Select
                  value={draft.subjectId || "none"}
                  onValueChange={(value) =>
                    setDraft((previous) => ({
                      ...previous,
                      subjectId: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="min-h-6">
                    <SelectValue placeholder="Choisir une matière" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDraftSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name} · coef. matière {subject.coefficient}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="evaluation-date">Date de l’évaluation</Label>
                <Input
                  id="evaluation-date"
                  type="date"
                  required
                  min={activePeriod?.startDate}
                  max={activePeriod?.endDate}
                  value={draft.evaluationDate}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      evaluationDate: event.target.value,
                    }))
                  }
                />
                {draftSubjectIsLocked ? (
                  <p className="text-xs text-muted-foreground">
                    {nextPeriod
                      ? `Le calcul est déjà lancé pour cette matière. Sélectionnez ${nextPeriod.label} pour y programmer l’évaluation lorsqu’elle sera ouverte.`
                      : "Le calcul est déjà lancé et aucune période suivante n’est configurée."}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Libellé</Label>
                <Input
                  placeholder="Devoir surveillé n°1"
                  value={draft.label}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      label: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Coefficient de cette évaluation</Label>
                <Input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={draft.coefficient}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      coefficient: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Ce coefficient ne modifie pas le coefficient général de la
                  matière.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                disabled={!canCreate || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Programmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <EvaluationGradesDialog
          evaluation={selectedEvaluation}
          classId={classId}
          gradingPeriodId={gradingPeriodId}
          students={studentsQuery.data?.data ?? []}
          readOnly={
            selectedEvaluation
              ? isSubjectClosed(selectedEvaluation.subjectId)
              : true
          }
          onOpenChange={(open) => !open && setSelectedEvaluationId(null)}
        />
      </div>
    </>
  );
}

function EvaluationGradeEditor({ evaluation, students, readOnly, onOpen }: { evaluation: EvaluationWithGrades; students: StudentItem[]; readOnly: boolean; onOpen: () => void }) {
  const completedCount = evaluation.grades.length
  const totalCount = students.length
  return <div className="rounded-lg border bg-background p-2 transition-colors hover:bg-muted/20">
    <Button type="button" variant="ghost" className="min-h-6 w-full justify-between gap-3 px-0 text-left" onClick={onOpen}>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{evaluation.label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{evaluation.subjectName ?? "-"} · {formatEvaluationDate(evaluation.evaluationDate)} · {evaluation.startTime || ""}</span>
      </span>
      <span className="shrink-0 text-right">
        <Badge variant={readOnly ? "success" : "secondary"}>{readOnly ? "Saisie clôturée" : `${completedCount}/${totalCount} notes`}</Badge>
        <span className="mt-1 block text-xs text-muted-foreground">{readOnly ? "Consulter les notes" : "Saisir les notes"}</span>
      </span>
    </Button>
  </div>
}

function EvaluationGradesDialog({ evaluation, classId, gradingPeriodId, students, readOnly, onOpenChange }: { evaluation: EvaluationWithGrades | null; classId: string; gradingPeriodId: string; students: StudentItem[]; readOnly: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const gradeMutation = useMutation({
    mutationFn: (input: { studentId: string; score: number | null }) => {
      if (!evaluation) throw new Error("Évaluation introuvable")
      return upsertEvaluationGrade(evaluation.id, { studentId: input.studentId, score: input.score, maxScore: GRADE_MAX })
    },
    onSuccess: async (_result, input) => {
      if (evaluation) await invalidateAcademicReportScope(queryClient, classId, gradingPeriodId)
      toast({ title: input.score === null ? "Note effacée" : "Note enregistrée" })
    },
    onError: (error) => toast({ title: "Enregistrement impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })

  return <Dialog open={Boolean(evaluation)} onOpenChange={onOpenChange}>
    <DialogContent className="grid max-h-[calc(95dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg p-0 sm:w-full" topNone="top-[54%]">
      <DialogHeader className="border-b px-5 py-5 text-left sm:px-6">
        <DialogTitle>Saisie des notes</DialogTitle>
        <DialogDescription>{evaluation ? `${evaluation.subjectName ?? "Matière"} · ${formatEvaluationDate(evaluation.evaluationDate)} · ${evaluation.startTime}-${evaluation.endTime} · ${evaluation.roomName} · coef. ${evaluation.coefficient}` : ""}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto py-1 sm:px-6 sm:py-5">
        {evaluation && students.length === 0 ? <EmptyState title="Aucun élève confirmé" description="Aucune inscription confirmée dans cette classe pour l’année scolaire de la saisie." classNameRendu="py-0" /> : null}
        {evaluation && students.length > 0 ? <div className="divide-y rounded-lg border">{students.map((student) => <GradeRow key={`${evaluation.id}-${student.id}-${evaluation.grades.find((item) => item.studentId === student.id)?.score ?? "empty"}`} fullName={`${student.firstName} ${student.lastName}`} initialScore={String(evaluation.grades.find((item) => item.studentId === student.id)?.score ?? "")} readOnly={readOnly} onSave={(score) => gradeMutation.mutateAsync({ studentId: student.id, score })} />)}</div> : null}
      </div>
    </DialogContent>
  </Dialog>
}

function GradeRow({ fullName, initialScore, onSave, readOnly }: { fullName: string; initialScore: string; onSave: (score: number | null) => Promise<unknown>; readOnly: boolean }) {
  const [score, setScore] = useState(initialScore)
  const parsed = Number(score.replace(",", "."))
  const valid = score !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= GRADE_MAX
  return <div className="flex flex-wrap items-center gap-1 p-3 sm:flex-nowrap sm:px-4"><p className="min-w-0 flex-1 font-medium">{fullName}</p><div className="flex w-full items-center gap-2 sm:w-auto"><div className="flex-1 sm:w-28"><Label className="sr-only" htmlFor={`grade-${fullName}`}>Note de {fullName}</Label><Input id={`grade-${fullName}`} aria-label={`Note de ${fullName}`} disabled={readOnly} type="number" min={0} max={GRADE_MAX} step={0.25} className="min-h-12" value={score} onChange={(event) => setScore(event.target.value)} /></div><span className="text-sm text-muted-foreground">/ {GRADE_MAX}</span><Button type="button" variant="outline" className="min-h-12" disabled={readOnly || !valid} onClick={() => void onSave(parsed)}>Enregistrer</Button>{initialScore !== "" ? <Button type="button" variant="ghost" className="min-h-12" disabled={readOnly} onClick={() => void onSave(null)}>Effacer</Button> : null}</div></div>
}
