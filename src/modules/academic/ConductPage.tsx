import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Gavel, Loader2, MessageSquareText } from "lucide-react"
import { useNavigate } from "react-router-dom"

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
  fetchConductOverview,
  fetchTeacherAcademicContext,
  fetchTeacherConductScope,
  listClasses,
  submitBulkConductInputs,
  submitConductInput,
} from "./academic.api"
import { listStudents } from "@/modules/students/students.api"

const CONDUCT_MAX = 20

type ConductView = "teacher" | "decision" | "all"

export default function ConductPage({ view = "all" }: { view?: ConductView }) {
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const isTeacher = user?.role === "teacher" || user?.role === "director"
  const canFinalize =
    user?.role === "director" || (permissions as string[] | undefined)?.includes("conduct.finalize") === true

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Conduite</h1>
        <p className="text-sm text-muted-foreground">
          Saisie des notes de conduite par les professeurs, décision finale par l&apos;éducateur assigné.
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
  const navigate = useNavigate()
  const [classId, setClassId] = useState("")
  const [gradingPeriodId, setGradingPeriodId] = useState("")
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
  const periodEnded = Boolean(
    selectedPeriod && new Date().toISOString().slice(0, 10) > selectedPeriod.endDate,
  )
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

  const availableStudents = (scopeQuery.data?.students ?? []).filter((student) => student.input === null)
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

        {classId && gradingPeriodId ? periodEnded ? (
          <EmptyState
            title="Période terminée"
            description="Les notes de conduite de cette période sont verrouillées et ne peuvent plus être ajoutées ou modifiées."
          />
        ) : scopeQuery.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des élèves…</p>
        ) : scopeQuery.isError ? (
          <p className="text-sm text-destructive">Impossible de charger les élèves de cette classe.</p>
        ) : scopeQuery.data?.isAvailable === false ? (
          <EmptyState
            title="Conduite pas encore ouverte"
            description="Passez d’abord au calcul des moyennes pour cette classe et cette période depuis Évaluations & notes."
            action={{
              label: "Passer au calcul des moyennes",
              onClick: () => navigate(`/academic/notes?classId=${encodeURIComponent(classId)}&gradingPeriodId=${encodeURIComponent(gradingPeriodId)}`),
            }}
          />
        ) : (
          <div className="space-y-5">
            {availableStudents.length > 0 ? (
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
              <EmptyState title="Aucun élève actif" description="La classe ne contient aucun élève disponible pour la saisie." />
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
  selected,
  onSelectedChange,
  onSave,
}: {
  studentId: string
  fullName: string
  existingInput: { note: number; observation: string | null; createdAt: string } | null
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  onSave: (note: number, observation?: string) => void
}) {
  const [note, setNote] = useState("")
  const [observation, setObservation] = useState("")
  const parsed = Number(note.replace(",", "."))
  const valid = note !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= CONDUCT_MAX

  return (
    <div className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[48px_1fr_100px_1fr_auto_auto]">
      <div className="flex min-h-12 items-center"><Checkbox aria-label={`Sélectionner ${fullName}`} checked={selected} disabled={existingInput !== null} onCheckedChange={(checked) => onSelectedChange(checked === true)} /></div>
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
          disabled={existingInput !== null}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="sr-only">Observation</Label>
        <Input
          placeholder="Observation (optionnel)"
          value={observation}
          disabled={existingInput !== null}
          onChange={(event) => setObservation(event.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-12"
        disabled={!valid || existingInput !== null}
        onClick={() => onSave(parsed, observation.trim() || undefined)}
      >
        Enregistrer
      </Button>
    </div>
  )
}

function EducatorDecisionSection() {
  const [classId, setClassId] = useState("")
  const [gradingPeriodId, setGradingPeriodId] = useState("")
  const [selectedStudentId, setSelectedStudentId] = useState("")

  const classesQuery = useQuery({
    queryKey: ["academic", "classes-for-decision"],
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
  const studentsQuery = useQuery({
    queryKey: ["students-list", classId],
    queryFn: () => listStudents({ classId, isActive: true, limit: 200 }),
    enabled: Boolean(classId),
  })

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Gavel className="h-4 w-4" />
          Décision finale (éducateur)
        </CardTitle>
        <CardDescription>
          Consultez les notes des professeurs et les remarques spontanées, puis arrêtez la note
          définitive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Classe assignée</Label>
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
            <Label>Période</Label>
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

        {classId && gradingPeriodId ? (
          <div className="space-y-2">
            <Label>Élève</Label>
            <Select
              value={selectedStudentId || "none"}
              onValueChange={(value) => setSelectedStudentId(value === "none" ? "" : value)}
            >
              <SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
              <SelectContent>
                {(studentsQuery.data?.data ?? []).map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.firstName} {student.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {selectedStudentId && gradingPeriodId ? (
          <EducatorDecisionPanel studentId={selectedStudentId} gradingPeriodId={gradingPeriodId} />
        ) : null}
      </CardContent>
    </Card>
  )
}

function EducatorDecisionPanel({
  studentId,
  gradingPeriodId,
}: {
  studentId: string
  gradingPeriodId: string
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
        <p className="mb-2 text-sm font-medium">Notes saisies par les professeurs</p>
        {overview.teacherInputs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune saisie pour cette période.</p>
        ) : (
          <ul className="space-y-1">
            {overview.teacherInputs.map((input) => (
              <li key={input.id} className="text-sm">
                <span className="font-medium">{input.teacherName}</span> : {input.note}/20
                {input.observation ? ` — ${input.observation}` : ""}
              </li>
            ))}
          </ul>
        )}
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
          <Label>Note définitive / {CONDUCT_MAX}</Label>
          <Input
            type="number"
            min={0}
            max={CONDUCT_MAX}
            step={0.5}
            className="max-w-24"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <Button
          type="button"
          className="min-h-12"
          disabled={!valid || decideMutation.isPending}
          onClick={() => decideMutation.mutate()}
        >
          {decideMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Arrêter la note
        </Button>
      </div>
    </div>
  )
}
