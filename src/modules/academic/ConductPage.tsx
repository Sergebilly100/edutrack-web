import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Gavel, Loader2, MessageSquareText } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import { useAuthStore } from "@/shared/store/auth.store"
import {
  decideConductGrade,
  fetchConductDecisionContext,
  fetchConductDecisionStudents,
  fetchConductOverview,
  fetchTeacherAcademicContext,
  fetchTeacherConductScope,
  submitBulkConductInputs,
  submitConductInput,
} from "./academic.api"

const CONDUCT_MAX = 20

type ConductView = "teacher" | "decision" | "all"

export default function ConductPage({ view = "all" }: { view?: ConductView }) {
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const isTeacher = user?.role === "teacher"
  const canFinalize =
    isTeacher || user?.role === "director" || (permissions as string[] | undefined)?.includes("conduct.finalize") === true

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Conduite</h1>
        <p className="text-sm text-muted-foreground">
          Les professeurs donnent leur avis pendant la revue. Le responsable configuré arrête la note finale.
        </p>
      </header>

      {view !== "decision" && isTeacher ? <TeacherConductSection /> : null}
      {view !== "teacher" && canFinalize ? <EducatorDecisionSection /> : null}
      {((view === "teacher" && !isTeacher) || (view === "decision" && !canFinalize) || (view === "all" && !isTeacher && !canFinalize)) ? (
        <EmptyState
          title="Accès non configuré"
          description="Ni la saisie professeur ni la décision éducateur ne sont disponibles pour votre compte."
        />
      ) : null}
    </div>
  )
}

function TeacherConductSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "")
  const [gradingPeriodId, setGradingPeriodId] = useState(searchParams.get("gradingPeriodId") ?? "")
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [bulkNote, setBulkNote] = useState("")
  const [bulkObservation, setBulkObservation] = useState("")

  const contextQuery = useQuery({
    queryKey: ["academic", "teacher-context"],
    queryFn: fetchTeacherAcademicContext,
  })
  const selectedClass = contextQuery.data?.classes.find((item) => item.id === classId)
  const periods = (contextQuery.data?.gradingPeriods ?? []).filter(
    (period) => !selectedClass || period.schoolYearId === selectedClass.schoolYearId,
  )
  const selectedPeriod = periods.find((period) => period.id === gradingPeriodId)
  const periodEnded = selectedPeriod?.conductReviewOpen === false || Boolean(selectedPeriod?.closedClassIds?.includes(classId))
  useEffect(() => {
    if (gradingPeriodId || periods.length === 0) return
    const current = periods.find((period) => period.conductReviewOpen)
    if (current) setGradingPeriodId(current.id)
  }, [gradingPeriodId, periods])
  const scopeQuery = useQuery({
    queryKey: ["conduct-input-scope", classId, gradingPeriodId],
    queryFn: () => fetchTeacherConductScope(classId, gradingPeriodId),
    enabled: Boolean(classId) && Boolean(gradingPeriodId),
  })

  const submitMutation = useMutation({
    mutationFn: (input: { studentId: string; note: number; observation?: string }) =>
      submitConductInput({
        student_id: input.studentId,
        grading_period_id: gradingPeriodId,
        note: input.note,
        observation: input.observation,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["conduct-input-scope", classId, gradingPeriodId] })
      await queryClient.invalidateQueries({ queryKey: ["conduct", "review-workspace"] })
      toast({ title: "Note de conduite enregistrée", duration: 3000 })
    },
    onError: (error) =>
      toast({
        title: "Enregistrement impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
        duration: 6000,
      }),
  })

  const bulkMutation = useMutation({
    mutationFn: () => submitBulkConductInputs({
      class_id: classId,
      student_ids: selectedStudentIds,
      grading_period_id: gradingPeriodId,
      note: Number(bulkNote.replace(",", ".")),
      observation: bulkObservation.trim() || undefined,
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["conduct-input-scope", classId, gradingPeriodId] })
      await queryClient.invalidateQueries({ queryKey: ["conduct", "review-workspace"] })
      setSelectedStudentIds([])
      setBulkNote("")
      setBulkObservation("")
      toast({ title: `${result.savedCount} note(s) de conduite enregistrée(s)` })
    },
    onError: (error) => toast({
      title: "Saisie en lot impossible",
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    }),
  })

  const availableStudents = (scopeQuery.data?.students ?? []).filter((student) => !student.isLocked)
  const parsedBulkNote = Number(bulkNote.replace(",", "."))
  const bulkValid = selectedStudentIds.length > 0 && bulkNote !== ""
    && Number.isFinite(parsedBulkNote) && parsedBulkNote >= 0 && parsedBulkNote <= CONDUCT_MAX

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" />
          Saisie professeur
        </CardTitle>
        <CardDescription>
          Une note par élève et par période. Vous pouvez saisir individuellement ou appliquer une même note à plusieurs élèves.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {contextQuery.isLoading ? <p role="status" className="text-sm text-muted-foreground">Chargement de vos classes…</p> : null}
        {contextQuery.isError ? <p role="alert" className="text-sm text-destructive">Impossible de charger vos classes.</p> : null}
        {contextQuery.isSuccess && contextQuery.data.classes.length === 0 ? <EmptyState title="Aucune classe affectée" description="Aucune affectation pédagogique ni aucun créneau actif ne vous associe à une classe." /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Classe</Label>
            <Select value={classId || "none"} onValueChange={(value) => {
              setClassId(value === "none" ? "" : value)
              setGradingPeriodId("")
              setSelectedStudentIds([])
            }}>
              <SelectTrigger className="min-h-12" aria-label="Classe"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
              <SelectContent>
                {(contextQuery.data?.classes ?? []).map((klass) => (
                  <SelectItem key={klass.id} value={klass.id}>{klass.name} · {klass.levelName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Période</Label>
            <Select
              value={gradingPeriodId || "none"}
              onValueChange={(value) => setGradingPeriodId(value === "none" ? "" : value)}
            >
              <SelectTrigger className="min-h-12" aria-label="Période"><SelectValue placeholder="Choisir une période" /></SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {classId && gradingPeriodId ? scopeQuery.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des élèves…</p>
        ) : scopeQuery.isError ? (
          <p className="text-sm text-destructive">Impossible de charger les élèves de cette classe.</p>
        ) : scopeQuery.data?.isAvailable === false ? (
          <EmptyState
            title="Revue de conduite indisponible"
            description="Les avis sont accessibles dès l’ouverture de la revue de conduite."
          />
        ) : (
          <div className="space-y-5">
            {periodEnded ? <div className="rounded-lg border border-muted-foreground/20 bg-muted/40 p-4 text-sm text-muted-foreground">Cette période est consultable, mais les notes de conduite sont verrouillées : elle est finalisée ou pas encore courante.</div> : null}
            {!periodEnded && availableStudents.length > 0 ? (
              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">Attribution en masse</p>
                  <p className="text-sm text-muted-foreground">Sélectionnez tous les élèves concernés, puis appliquez la même note.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => setSelectedStudentIds(availableStudents.map((student) => student.studentId))}>Sélectionner tous</Button>
                  <Button type="button" variant="ghost" className="min-h-12" onClick={() => setSelectedStudentIds([])}>Effacer la sélection</Button>
                  <Badge variant="secondary" className="min-h-12 px-3">{selectedStudentIds.length} sélectionné(s)</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
                  <div className="space-y-1"><Label htmlFor="bulk-conduct-note">Note / 20</Label><Input id="bulk-conduct-note" type="number" min={0} max={20} step={0.5} value={bulkNote} onChange={(event) => setBulkNote(event.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="bulk-conduct-observation">Observation commune</Label><Input id="bulk-conduct-observation" placeholder="Optionnel" value={bulkObservation} onChange={(event) => setBulkObservation(event.target.value)} /></div>
                  <Button type="button" className="min-h-12" disabled={!bulkValid || bulkMutation.isPending} onClick={() => bulkMutation.mutate()}>{bulkMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Appliquer à la sélection</Button>
                </div>
              </div>
            ) : null}
            {(scopeQuery.data?.students ?? []).map((student) => (
              <ConductInputRow
                key={student.studentId}
                studentId={student.studentId}
                fullName={student.fullName}
                existingInput={student.input}
                readOnly={periodEnded || student.isLocked}
                selected={selectedStudentIds.includes(student.studentId)}
                onSelectedChange={(selected) => setSelectedStudentIds((current) => selected
                  ? [...current, student.studentId]
                  : current.filter((id) => id !== student.studentId))}
                onSave={(note, observation) => {
                  void submitMutation
                    .mutateAsync({ studentId: student.studentId, note, observation })
                    .then(() => queryClient.invalidateQueries({ queryKey: ["conduct-overview", student.studentId] }))
                }}
              />
            ))}
            {(scopeQuery.data?.students.length ?? 0) === 0 ? (
              <EmptyState title="Aucun élève confirmé" description="Aucune inscription confirmée dans cette classe pour l’année scolaire de la saisie." />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ConductInputRow({
  studentId,
  fullName,
  existingInput,
  readOnly,
  selected,
  onSelectedChange,
  onSave,
}: {
  studentId: string
  fullName: string
  existingInput: { note: number; observation: string | null; createdAt: string } | null
  readOnly: boolean
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  onSave: (note: number, observation?: string) => void
}) {
  const [note, setNote] = useState(existingInput ? String(existingInput.note) : "")
  const [observation, setObservation] = useState(existingInput?.observation ?? "")
  const parsed = Number(note.replace(",", "."))
  const valid = note !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= CONDUCT_MAX

  return (
    <div className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[48px_1fr_100px_1fr_auto_auto]">
      <div className="flex min-h-12 items-center"><Checkbox aria-label={`Sélectionner ${fullName}`} checked={selected} disabled={readOnly} onCheckedChange={(checked) => onSelectedChange(checked === true)} /></div>
      <div className="min-h-12 flex flex-col justify-center"><p className="font-medium">{fullName}</p>{existingInput ? <p className="text-xs text-muted-foreground">Déjà saisie : {existingInput.note}/20{existingInput.observation ? ` · ${existingInput.observation}` : ""}</p> : null}</div>
      <div className="space-y-1">
        <Label className="sr-only">Note</Label>
        <Input
          type="number"
          min={0}
          max={CONDUCT_MAX}
          step={0.5}
          placeholder={`/${CONDUCT_MAX}`}
          value={note}
          disabled={readOnly}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="sr-only">Observation</Label>
        <Input
          placeholder="Observation (optionnel)"
          value={observation}
          disabled={readOnly}
          onChange={(event) => setObservation(event.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-12"
        disabled={readOnly || !valid}
        onClick={() => onSave(parsed, observation.trim() || undefined)}
      >
        {existingInput ? "Corriger" : "Enregistrer"}
      </Button>
    </div>
  )
}

function EducatorDecisionSection() {
  const [classId, setClassId] = useState("")
  const [gradingPeriodId, setGradingPeriodId] = useState("")
  const [selectedStudentId, setSelectedStudentId] = useState("")

  const contextQuery = useQuery({
    queryKey: ["conduct", "decision-context"],
    queryFn: fetchConductDecisionContext,
  })
  const selectedClass = contextQuery.data?.classes.find((item) => item.id === classId)
  const periods = (contextQuery.data?.gradingPeriods ?? []).filter(
    (period) => !selectedClass || period.schoolYearId === selectedClass.schoolYearId,
  )
  const studentsQuery = useQuery({
    queryKey: ["conduct", "decision-students", classId, gradingPeriodId],
    queryFn: () => fetchConductDecisionStudents(classId, gradingPeriodId),
    enabled: Boolean(classId && gradingPeriodId),
  })
  const selectedPeriod = periods.find((period) => period.id === gradingPeriodId)
  const isReadOnly = selectedPeriod?.conductReviewOpen === false || Boolean(selectedPeriod?.closedClassIds?.includes(classId))

  useEffect(() => {
    if (gradingPeriodId || periods.length === 0) return
    const current = periods.find((period) => period.conductReviewOpen)
    if (current) setGradingPeriodId(current.id)
  }, [gradingPeriodId, periods])

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Gavel className="h-4 w-4" />
          Décision finale de conduite
        </CardTitle>
        <CardDescription>
          Consultez les notes des professeurs et les remarques spontanées, puis arrêtez la note
          définitive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {contextQuery.isLoading ? <p role="status" className="text-sm text-muted-foreground">Chargement des classes autorisées…</p> : null}
        {contextQuery.isError ? <p role="alert" className="text-sm text-destructive">Impossible de charger les classes autorisées.</p> : null}
        {contextQuery.isSuccess && contextQuery.data.classes.length === 0 ? <EmptyState title="Aucune décision autorisée" description="La direction configure le responsable de conduite dans Paramètres." /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Classe à décider</Label>
            <Select value={classId || "none"} onValueChange={(value) => {
              setClassId(value === "none" ? "" : value)
              setGradingPeriodId("")
              setSelectedStudentId("")
            }}>
              <SelectTrigger className="min-h-12" aria-label="Classe à décider"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
              <SelectContent>
                {(contextQuery.data?.classes ?? []).map((klass) => (
                  <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Période</Label>
            <Select
              value={gradingPeriodId || "none"}
              onValueChange={(value) => setGradingPeriodId(value === "none" ? "" : value)}
            >
              <SelectTrigger className="min-h-12" aria-label="Période"><SelectValue placeholder="Choisir une période" /></SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.label}{period.closedClassIds.includes(classId) ? " · finalisée" : period.conductReviewOpen ? " · en revue" : " · à venir"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {classId && gradingPeriodId ? (
          <div className="space-y-2">
            <Label>Élève</Label>
            <Select
              value={selectedStudentId || "none"}
              onValueChange={(value) => setSelectedStudentId(value === "none" ? "" : value)}
            >
              <SelectTrigger className="min-h-12" aria-label="Élève"><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
              <SelectContent>
                {(studentsQuery.data?.students ?? []).map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {studentsQuery.isLoading ? <p role="status" className="text-sm text-muted-foreground">Chargement des élèves…</p> : null}
            {studentsQuery.isError ? <p role="alert" className="text-sm text-destructive">Impossible de charger les élèves confirmés.</p> : null}
            {studentsQuery.isSuccess && studentsQuery.data.students.length === 0 ? <EmptyState title="Aucun élève confirmé" description="Cette classe ne comporte aucun élève confirmé pour cette année." /> : null}
          </div>
        ) : null}

        {isReadOnly ? (
          <div className="rounded-lg border border-muted-foreground/20 bg-muted/40 p-4 text-sm text-muted-foreground">
            Cette période est consultable uniquement : les bulletins sont déjà générés ou la période n&apos;est pas encore courante.
          </div>
        ) : null}

        {selectedStudentId && gradingPeriodId ? (
          <EducatorDecisionPanel studentId={selectedStudentId} gradingPeriodId={gradingPeriodId} readOnly={isReadOnly} />
        ) : null}
      </CardContent>
    </Card>
  )
}

function EducatorDecisionPanel({
  studentId,
  gradingPeriodId,
  readOnly,
}: {
  studentId: string
  gradingPeriodId: string
  readOnly: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [note, setNote] = useState("")

  const overviewQuery = useQuery({
    queryKey: ["conduct-overview", studentId, gradingPeriodId],
    queryFn: () => fetchConductOverview(studentId, gradingPeriodId),
  })

  const decideMutation = useMutation({
    mutationFn: () =>
      decideConductGrade({
        student_id: studentId,
        grading_period_id: gradingPeriodId,
        note: Number(note.replace(",", ".")),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["conduct-overview", studentId, gradingPeriodId] })
      setNote("")
      toast({ title: "Note définitive enregistrée", duration: 3000 })
    },
    onError: (error) =>
      toast({
        title: "Décision impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
        duration: 6000,
      }),
  })

  if (overviewQuery.isLoading) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
  }
  if (overviewQuery.isError) {
    return <p className="text-sm text-red-600">Impossible de charger le dossier de conduite.</p>
  }

  const overview = overviewQuery.data!
  const parsed = Number(note.replace(",", "."))
  const valid = note !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= CONDUCT_MAX

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{overview.student.className}</Badge>
        {overview.finalGrade ? (
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
            Note définitive : {overview.finalGrade.note}/20
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
            Pas encore de note définitive
          </Badge>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Notes saisies par les professeurs</p>
          <Badge variant={overview.inputSummary.isComplete ? "success" : "secondary"}>
            {overview.inputSummary.submittedCount}/{overview.inputSummary.expectedCount} renseignés
          </Badge>
        </div>
        {overview.teacherInputs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun enseignant n’est affecté à cette classe.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {overview.teacherInputs.map((input) => (
              <li key={input.teacherId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <span className="font-medium">{input.teacherName}</span>
                  {input.isSubmitted ? ` : ${input.note}/20` : ""}
                  {input.observation ? ` - ${input.observation}` : ""}
                </span>
                {!input.isSubmitted ? <Badge variant="outline">À renseigner</Badge> : null}
              </li>
            ))}
          </ul>
        )}
        {!overview.inputSummary.isComplete ? <p className="mt-2 text-sm text-muted-foreground">Les avis manquants peuvent être relancés. Ils ne bloquent pas la décision.</p> : null}
      </div>

      {overview.spontaneousEvaluations.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium">Remarques spontanées</p>
          <ul className="space-y-1">
            {overview.spontaneousEvaluations.map((item) => (
              <li key={item.id} className="text-sm">
                {item.score > 0 ? "+" : "-"} {item.comment ?? item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="final-conduct-decision">Note définitive / {CONDUCT_MAX}</Label>
          <Input
            id="final-conduct-decision"
            type="number"
            min={0}
            max={CONDUCT_MAX}
            step={0.5}
            className="max-w-24"
            value={note}
            disabled={readOnly}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <Button
          type="button"
          className="min-h-12"
          disabled={readOnly || !valid || decideMutation.isPending}
          onClick={() => decideMutation.mutate()}
        >
          {decideMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {overview.finalGrade ? "Rectifier la note" : "Arrêter la note"}
        </Button>
      </div>
    </div>
  )
}
