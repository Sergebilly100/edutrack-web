import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Gavel, Loader2, MessageSquareText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import { useAuthStore } from "@/shared/store/auth.store"
import {
  decideConductGrade,
  fetchConductOverview,
  listClasses,
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
  const [classId, setClassId] = useState("")
  const [gradingPeriodId, setGradingPeriodId] = useState("")

  const classesQuery = useQuery({
    queryKey: ["academic", "classes-for-conduct"],
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

  const submitMutation = useMutation({
    mutationFn: (input: { studentId: string; note: number; observation?: string }) =>
      submitConductInput({
        student_id: input.studentId,
        grading_period_id: gradingPeriodId,
        note: input.note,
        observation: input.observation,
      }),
    onSuccess: () => toast({ title: "Note de conduite enregistrée", duration: 3000 }),
    onError: (error) =>
      toast({
        title: "Enregistrement impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
        duration: 6000,
      }),
  })

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" />
          Saisie professeur
        </CardTitle>
        <CardDescription>
          Une seule note de conduite par élève et par période. Une fois enregistrée, la ligne est
          verrouillée.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <div className="space-y-3">
            {(studentsQuery.data?.data ?? []).map((student) => (
              <ConductInputRow
                key={student.id}
                fullName={`${student.firstName} ${student.lastName}`}
                onSave={(note, observation) => {
                  void submitMutation
                    .mutateAsync({ studentId: student.id, note, observation })
                    .then(() => queryClient.invalidateQueries({ queryKey: ["conduct-overview", student.id] }))
                }}
              />
            ))}
            {(studentsQuery.data?.data.length ?? 0) === 0 && !studentsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Aucun élève actif dans cette classe.</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ConductInputRow({
  fullName,
  onSave,
}: {
  fullName: string
  onSave: (note: number, observation?: string) => void
}) {
  const [note, setNote] = useState("")
  const [observation, setObservation] = useState("")
  const parsed = Number(note.replace(",", "."))
  const valid = note !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= CONDUCT_MAX

  return (
    <div className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_100px_1fr_auto]">
      <p className="min-h-12 flex items-center font-medium">{fullName}</p>
      <div className="space-y-1">
        <Label className="sr-only">Note</Label>
        <Input
          type="number"
          min={0}
          max={CONDUCT_MAX}
          step={0.5}
          placeholder={`/${CONDUCT_MAX}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="sr-only">Observation</Label>
        <Input
          placeholder="Observation (optionnel)"
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-12"
        disabled={!valid}
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
