import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, CalendarPlus, Loader2 } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { isCivilDate } from "@/shared/lib/date-validation"
import { currentAcademicPeriodId } from "@/shared/lib/academic-context"
import { businessToday } from "@/shared/lib/academic-calendar"
import { listStudents, type StudentItem } from "@/modules/students/students.api"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  createEvaluation,
  dayLabel,
  fetchEntryPeriod,
  fetchEvaluationsScope,
  fetchTeacherAcademicContext,
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
  const [searchParams] = useSearchParams()
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "")
  const [selectedPeriodId, setSelectedPeriodId] = useState(searchParams.get("gradingPeriodId") ?? "")
  const [createOpen, setCreateOpen] = useState(false)
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
  const today = businessToday()
  const gradingPeriodId = selectedPeriodId
    || currentAcademicPeriodId(periods.filter((period) => period.notesEntryOpen), today)
    || periods.find((period) => period.notesEntryOpen)?.id || ""
  const activePeriod = periods.find((period) => period.id === gradingPeriodId)
  const isPeriodClosedFromContext = Boolean(activePeriod?.isCompleted || activePeriod?.closedClassIds?.includes(classId))

  const scopeEnabled = Boolean(classId) && Boolean(gradingPeriodId)
  const scopeQuery = useQuery({
    queryKey: ["evaluations-scope", classId, gradingPeriodId],
    queryFn: () => fetchEvaluationsScope(classId, gradingPeriodId),
    enabled: scopeEnabled,
  })
  const isPeriodReadOnly = isPeriodClosedFromContext || Boolean(scopeQuery.data?.periodState?.isClosed)
  const entryPeriodQuery = useQuery({
    queryKey: ["evaluations", "entry-period", classId, draft.evaluationDate],
    queryFn: () => fetchEntryPeriod(classId, draft.evaluationDate),
    enabled: createOpen && Boolean(classId && draft.evaluationDate && isCivilDate(draft.evaluationDate)),
  })
  const creationPeriodId = entryPeriodQuery.data?.period?.id ?? ""
  const creationScopeQuery = useQuery({
    queryKey: ["evaluations-scope", classId, creationPeriodId, draft.evaluationDate],
    queryFn: () => fetchEvaluationsScope(classId, creationPeriodId, draft.evaluationDate),
    enabled: createOpen && Boolean(creationPeriodId && draft.evaluationDate),
  })
  const creationScope = creationScopeQuery.data
  const studentsQuery = useQuery({
    queryKey: ["students-list", classId],
    queryFn: () => listStudents({ classId, isActive: true, limit: 100 }),
    enabled: Boolean(classId),
  })
  const invalidateScope = (periodId = gradingPeriodId) => invalidateAcademicReportScope(queryClient, classId, periodId)

  const createMutation = useMutation({
    mutationFn: () => createEvaluation({
      ...(draft.lessonSlotId ? { lessonSlotId: draft.lessonSlotId } : {}),
      subjectId: draft.subjectId,
      classId,
      gradingPeriodId: creationPeriodId,
      type: "scheduled",
      coefficient: Number(draft.coefficient),
      label: draft.label.trim(),
      evaluationDate: draft.evaluationDate,
    }),
    onSuccess: async () => {
      await invalidateScope(creationPeriodId)
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

  const scheduledEvaluations = scopeQuery.data?.evaluations.filter((item) => item.type === "scheduled") ?? []
  const completionBySubject = new Map((scopeQuery.data?.completion ?? []).map((item) => [item.subjectId, item]))
  const correctionBySubject = new Map((scopeQuery.data?.correctionStatuses ?? []).map((item) => [item.subjectId, item.status]))
  const isSubjectClosed = (subjectId: string | null | undefined) =>
    isPeriodReadOnly || completionBySubject.get(subjectId ?? "")?.status === "completed"
  const draftDayOfWeek = draft.evaluationDate && isCivilDate(draft.evaluationDate)
    ? new Date(`${draft.evaluationDate}T00:00:00Z`).getUTCDay() || 7
    : null
  const draftLessonSlots = (creationScope?.lessonSlots ?? []).filter((item) => item.dayOfWeek === draftDayOfWeek)
  const draftDayLabel = draftDayOfWeek ? dayLabel(draftDayOfWeek).toLowerCase() : null
  const selectedDraftSlot = draftLessonSlots.find((item) => item.id === draft.lessonSlotId)
  const availableDraftSubjects = selectedDraftSlot?.subjectId
    ? (creationScope?.subjects ?? []).filter((item) => item.id === selectedDraftSlot.subjectId)
    : (creationScope?.subjects ?? [])
  const draftSubjectIsLocked = creationScope?.completion.some((item) => item.subjectId === draft.subjectId && item.status === "completed") ?? false
  const evaluationDateError = draft.evaluationDate && !isCivilDate(draft.evaluationDate)
    ? "Choisissez une date réelle." : entryPeriodQuery.data && !entryPeriodQuery.data.period
      ? entryPeriodQuery.data.code === "FINAL_PERIOD_CALCULATION_STARTED"
        ? "Le calcul des moyennes de la dernière période a commencé : aucune nouvelle évaluation ne peut être programmée pour cette année."
        : "Aucune période de saisie n’est ouverte pour cette date. Demandez à la direction de vérifier le calendrier."
      : entryPeriodQuery.isError ? "Impossible de vérifier le calendrier. Réessayez." : null
  const canCreate = draft.label.trim() !== "" && draft.subjectId !== "" && draft.evaluationDate !== "" && !evaluationDateError
    && Boolean(creationPeriodId && creationScope) && !creationScope?.periodState.isClosed && !draftSubjectIsLocked
    && (!selectedDraftSlot || Boolean(selectedDraftSlot.subjectId))
    && availableDraftSubjects.some((subject) => subject.id === draft.subjectId)
    && Number.isFinite(Number(draft.coefficient)) && Number(draft.coefficient) > 0
  const selectedEvaluation = scheduledEvaluations.find((evaluation) => evaluation.id === selectedEvaluationId) ?? null
  return (
    <> 
      <div className="space-y-4">

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-1">

            <h1 className="text-2xl font-semibold tracking-tight">
              Évaluations & notes
            </h1>
            <p className="text-sm text-muted-foreground">
              Programmez les évaluations et saisissez les notes pour une classe et une
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
              {(scopeQuery.data?.completion ?? []).filter((item) => item.status === "completed" || correctionBySubject.has(item.subjectId)).map((item) => <p key={item.subjectId} className="mb-2 text-sm text-muted-foreground">{item.subjectName} : {item.status === "completed" ? "Validée, saisie clôturée" : "Correction ouverte, saisie autorisée"}{correctionBySubject.has(item.subjectId) ? ` · réclamation ${correctionBySubject.get(item.subjectId) === "approved" ? "approuvée" : "en traitement"}` : ""}</p>)}
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

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Pour calculer ou valider les moyennes, consultez l’état de chaque matière dans Moyennes.</p>
              <Button asChild variant="outline" className="min-h-10">
                <Link to={`/academic/notes?tab=moyennes&classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(gradingPeriodId)}`}>
                  Aller aux moyennes <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-xl overflow-y-auto rounded-lg sm:w-full">
            <DialogHeader>
              <DialogTitle>Programmer une évaluation</DialogTitle>
              <DialogDescription>
                Choisissez d’abord la date pour charger les matières et les créneaux de l’emploi du temps. Le créneau reste facultatif.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evaluation-date">Date de l’évaluation</Label>
                <Input
                  id="evaluation-date"
                  type="date"
                  required
                  aria-invalid={Boolean(evaluationDateError)}
                  aria-describedby={evaluationDateError ? "evaluation-date-error" : undefined}
                  value={draft.evaluationDate}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      evaluationDate: event.target.value,
                      lessonSlotId: "",
                      subjectId: "",
                    }))
                  }
                />
                {evaluationDateError ? <p id="evaluation-date-error" role="alert" className="text-sm text-destructive">{evaluationDateError}</p> : null}
                {entryPeriodQuery.isLoading || creationScopeQuery.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Vérification de la période…</p> : null}
                {entryPeriodQuery.data?.period ? <p className="text-sm text-muted-foreground">Période de saisie : {entryPeriodQuery.data.period.label}</p> : null}
                {creationScopeQuery.isError ? <p role="alert" className="text-sm text-destructive">Impossible de charger les matières et les créneaux pour cette date. Réessayez.</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Créneau {draftDayLabel ? `du ${draftDayLabel}` : "de cours"} (facultatif)</Label>
                <Select
                  value={draft.lessonSlotId || "none"}
                  disabled={!creationScope}
                  onValueChange={(value) => {
                    const slot = draftLessonSlots.find(
                      (item) => item.id === value,
                    );
                    setDraft((previous) => ({
                      ...previous,
                      lessonSlotId: value === "none" ? "" : value,
                      subjectId: slot?.subjectId ?? previous.subjectId,
                    }));
                  }}
                >
                  <SelectTrigger className="min-h-6" aria-label="Créneau de cours">
                    <SelectValue placeholder="Aucun créneau EDT" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans créneau EDT</SelectItem>
                    {draftLessonSlots.map((slot) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {dayLabel(slot.dayOfWeek)} · {slot.startTime}-
                        {slot.endTime} · {slot.roomName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {creationScope && draftLessonSlots.length === 0 ? <p className="text-sm text-muted-foreground">Aucun créneau EDT {draftDayLabel ? `le ${draftDayLabel}` : ""} pour cette classe à cette date. Vous pouvez programmer l’évaluation sans créneau.</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Matière</Label>
                {selectedDraftSlot && !selectedDraftSlot.subjectId ? (
                  <p className="text-sm text-amber-800">La direction doit corriger la matière officielle de ce créneau dans l’emploi du temps.</p>
                ) : null}
                <Select
                  value={draft.subjectId || "none"}
                  disabled={!creationScope || availableDraftSubjects.length === 0}
                  onValueChange={(value) =>
                    setDraft((previous) => ({
                      ...previous,
                      subjectId: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="min-h-6" aria-label="Matière de l’évaluation">
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
                {creationScope && creationScope.subjects.length === 0 ? <p role="alert" className="text-sm text-destructive">Aucune matière officielle n’est liée à votre affectation ou à votre EDT pour cette classe. Demandez à la direction de vérifier les matières des créneaux.</p> : null}
                {draftSubjectIsLocked ? (
                  <p className="text-xs text-muted-foreground">
                    La saisie est clôturée pour cette matière dans la période indiquée.
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
