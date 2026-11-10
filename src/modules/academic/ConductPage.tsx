import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, MessageSquareText } from "lucide-react"
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
import {
  type ConductReviewAction,
  fetchTeacherConductScope,
  submitBulkConductInputs,
  submitConductInput,
} from "./academic.api"

const CONDUCT_MAX = 20

export default function ConductPage({ openScopes }: { openScopes: ConductReviewAction[] }) {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Conduite</h1>
        <p className="text-sm text-muted-foreground">
          Les professeurs donnent leur avis pendant la revue. Le responsable configuré arrête la note finale.
        </p>
      </header>

      <TeacherConductSection openScopes={openScopes} />
    </div>
  )
}

function TeacherConductSection({ openScopes }: { openScopes: ConductReviewAction[] }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "")
  const [gradingPeriodId, setGradingPeriodId] = useState(searchParams.get("gradingPeriodId") ?? "")
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [bulkNote, setBulkNote] = useState("")
  const [bulkObservation, setBulkObservation] = useState("")

  const classes = [...new Map(openScopes.map((scope) => [scope.classId, scope.className])).entries()]
  const selectedClassId = classes.some(([id]) => id === classId) ? classId : (classes[0]?.[0] ?? "")
  const periods = openScopes.filter((scope) => scope.classId === selectedClassId)
  const selectedPeriod = periods.find((scope) => scope.gradingPeriodId === gradingPeriodId) ?? periods[0]
  const selectedPeriodId = selectedPeriod?.gradingPeriodId ?? ""
  useEffect(() => { setSelectedStudentIds([]) }, [selectedClassId, selectedPeriodId])
  const scopeQuery = useQuery({
    queryKey: ["conduct-input-scope", selectedClassId, selectedPeriodId],
    queryFn: () => fetchTeacherConductScope(selectedClassId, selectedPeriodId),
    enabled: Boolean(selectedClassId) && Boolean(selectedPeriodId),
  })

  const submitMutation = useMutation({
    mutationFn: (input: { studentId: string; note: number; observation?: string }) =>
      submitConductInput({
        student_id: input.studentId,
        grading_period_id: selectedPeriodId,
        note: input.note,
        observation: input.observation,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["conduct-input-scope", selectedClassId, selectedPeriodId] })
      await queryClient.invalidateQueries({ queryKey: ["conduct", "teacher-actions"] })
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
      class_id: selectedClassId,
      student_ids: selectedStudentIds,
      grading_period_id: selectedPeriodId,
      note: Number(bulkNote.replace(",", ".")),
      observation: bulkObservation.trim() || undefined,
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["conduct-input-scope", selectedClassId, selectedPeriodId] })
      await queryClient.invalidateQueries({ queryKey: ["conduct", "teacher-actions"] })
      setSelectedStudentIds([])
      setBulkNote("")
      setBulkObservation("")
      toast({ title: `${result.savedCount} note(s) de conduite enregistrée(s)` })
    },
    onError: (error) => toast({
      title: "Saisie en lot impossible",
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
      duration: 6000,
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
        {openScopes.length === 0 ? <EmptyState title="Fenêtre de revue terminée" description="Les avis de conduite ne sont plus modifiables pour cette période." /> : null}
        {selectedPeriod ? <p className="text-sm text-muted-foreground">Revue ouverte jusqu’au {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" }).format(new Date(`${selectedPeriod.endDate}T12:00:00Z`))}.</p> : null}
        {selectedPeriod && selectedPeriod.pendingCount === 0 ? <p className="text-sm text-muted-foreground">Aucun avis restant à renseigner. Les avis non verrouillés restent modifiables pendant la revue.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2" data-tour="conduct-filters">
          <div className="space-y-2">
            <Label>Classe</Label>
            <Select value={selectedClassId || "none"} onValueChange={(value) => {
              setClassId(value === "none" ? "" : value)
              setGradingPeriodId("")
              setSelectedStudentIds([])
            }}>
              <SelectTrigger className="min-h-12" aria-label="Classe"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
              <SelectContent>
                {classes.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Période</Label>
            <Select
              value={selectedPeriodId || "none"}
              onValueChange={(value) => setGradingPeriodId(value === "none" ? "" : value)}
            >
              <SelectTrigger className="min-h-12" aria-label="Période"><SelectValue placeholder="Choisir une période" /></SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.gradingPeriodId} value={period.gradingPeriodId}>{period.gradingPeriodLabel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedClassId && selectedPeriodId ? scopeQuery.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des élèves…</p>
        ) : scopeQuery.isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive"><span>Impossible de charger les élèves de cette classe.</span><Button type="button" variant="outline" className="min-h-12" onClick={() => void scopeQuery.refetch()}>Réessayer</Button></div>
        ) : scopeQuery.data?.isAvailable === false ? (
          <EmptyState
            title="Revue de conduite indisponible"
            description="Les avis sont accessibles dès l’ouverture de la revue de conduite."
          />
        ) : (
          <div className="space-y-5">
            {availableStudents.length > 0 ? (
              <div className="space-y-3 rounded-lg border p-4" data-tour="conduct-bulk">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Checkbox
                      aria-label="Sélectionner tous les élèves"
                      checked={availableStudents.every((student) => selectedStudentIds.includes(student.studentId))}
                      onCheckedChange={(checked) => setSelectedStudentIds(checked === true
                        ? availableStudents.map((student) => student.studentId)
                        : [])}
                    />
                    <p className="font-medium">Attribution en masse</p>
                    <Badge variant="secondary" className="min-h-6 px-3">{selectedStudentIds.length} sélectionné(s)</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Sélectionnez tous les élèves, puis appliquez la même note.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
                  <div className="space-y-1"><Label htmlFor="bulk-conduct-note">Note / 20</Label><Input id="bulk-conduct-note" type="number" min={0} max={20} step={0.5} value={bulkNote} onChange={(event) => setBulkNote(event.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="bulk-conduct-observation">Observation commune</Label><Input id="bulk-conduct-observation" placeholder="Optionnel" value={bulkObservation} onChange={(event) => setBulkObservation(event.target.value)} /></div>
                  <Button type="button" className="min-h-12" disabled={!bulkValid || bulkMutation.isPending} onClick={() => bulkMutation.mutate()}>{bulkMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{bulkMutation.isPending ? "Enregistrement…" : "Appliquer à la sélection"}</Button>
                </div>
              </div>
            ) : null}
            {(scopeQuery.data?.students ?? []).map((student) => (
              <ConductInputRow
                key={student.studentId}
                studentId={student.studentId}
                fullName={student.fullName}
                existingInput={student.input}
                readOnly={student.isLocked}
                isSaving={submitMutation.isPending && submitMutation.variables?.studentId === student.studentId}
                selected={selectedStudentIds.includes(student.studentId)}
                onSelectedChange={(selected) => setSelectedStudentIds((current) => selected
                  ? [...current, student.studentId]
                  : current.filter((id) => id !== student.studentId))}
                onSave={(note, observation) => {
                  submitMutation.mutate({ studentId: student.studentId, note, observation }, {
                    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["conduct-overview", student.studentId] }),
                  })
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
  isSaving,
  selected,
  onSelectedChange,
  onSave,
}: {
  studentId: string
  fullName: string
  existingInput: { note: number; observation: string | null; createdAt: string } | null
  readOnly: boolean
  isSaving: boolean
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  onSave: (note: number, observation?: string) => void
}) {
  const [note, setNote] = useState(existingInput ? String(existingInput.note) : "")
  const [observation, setObservation] = useState(existingInput?.observation ?? "")
  const parsed = Number(note.replace(",", "."))
  const valid = note !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= CONDUCT_MAX

  return (
    <div className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_100px_1fr_auto]">
      <div className="flex min-h-12 items-center gap-2">
        <Checkbox aria-label={`Sélectionner ${fullName}`} checked={selected} disabled={readOnly} onCheckedChange={(checked) => onSelectedChange(checked === true)} />
        <div className="flex min-w-0 flex-col justify-center"><p className="font-medium">{fullName}</p>{existingInput ? <p className="text-xs text-muted-foreground">Déjà saisie : {existingInput.note}/20{existingInput.observation ? ` · ${existingInput.observation}` : ""}</p> : null}</div>
      </div>
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
        disabled={readOnly || isSaving || !valid}
        onClick={() => onSave(parsed, observation.trim() || undefined)}
      >
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isSaving ? "Enregistrement…" : existingInput ? "Corriger" : "Enregistrer"}
      </Button>
    </div>
  )
}
