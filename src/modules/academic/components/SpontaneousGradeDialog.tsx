import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  createSpontaneousGrade,
  fetchEntryPeriod,
} from "@/modules/academic/academic.api"
import { hasValidatedTeacherPresence, type ScheduleSlot, type TeacherAttendance } from "@/modules/attendance/attendance.api"
import { listStudents } from "@/modules/students/students.api"
import { useToast } from "@/components/ui/use-toast"
import { invalidateAcademicReportScope } from "@/modules/academic/academic-report-cache"

type SpontaneousGradeDialogProps = {
  open: boolean
  slot: ScheduleSlot | null
  attendance?: TeacherAttendance
  onOpenChange: (open: boolean) => void
}

const toEvaluationDate = (slot: ScheduleSlot): string => slot.date ?? ""

export function SpontaneousGradeDialog({ open, slot, attendance, onOpenChange }: SpontaneousGradeDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [studentId, setStudentId] = useState("")
  const [adjustment, setAdjustment] = useState("0")
  const [comment, setComment] = useState("")
  const classId = slot?.class_id ?? ""
  const evaluationDate = slot ? toEvaluationDate(slot) : ""
  const entryPeriodQuery = useQuery({
    queryKey: ["evaluations", "entry-period", classId, evaluationDate],
    queryFn: () => fetchEntryPeriod(classId, evaluationDate),
    enabled: open && Boolean(classId && evaluationDate),
  })
  const gradingPeriod = entryPeriodQuery.data?.period
  const studentsQuery = useQuery({
    queryKey: ["students-list", classId],
    queryFn: () => listStudents({ classId, isActive: true, limit: 100 }),
    enabled: open && Boolean(classId),
  })
  const subjectId = slot?.subject_id ?? ""
  const parsedAdjustment = Number(adjustment.replace(",", "."))
  const canSave = Boolean(slot?.date && gradingPeriod && studentsQuery.data && subjectId && studentId && comment.trim())
    && hasValidatedTeacherPresence(attendance)
    && Number.isFinite(parsedAdjustment)
    && parsedAdjustment !== 0
    && Math.abs(parsedAdjustment) <= 20
  const unavailableReason = (() => {
    if (!slot || entryPeriodQuery.isLoading) return null
    if (!slot.date) return "La date de cette occurrence de cours est indisponible."
    if (!hasValidatedTeacherPresence(attendance)) return "La présence du professeur à ce cours doit être confirmée et validée avant la saisie."
    if (entryPeriodQuery.isError) return "Impossible de vérifier la période de saisie. Réessayez."
    if (!gradingPeriod) return entryPeriodQuery.data?.code === "FINAL_PERIOD_CALCULATION_STARTED"
      ? "Le calcul des moyennes de la dernière période a commencé : les notes spontanées sont fermées pour cette année."
      : entryPeriodQuery.data?.code === "SCHOOL_YEAR_NOT_STARTED"
        ? "Cette année scolaire n’a pas encore commencé."
      : "Aucune période de saisie n’est ouverte pour cette date. Demandez à la direction de vérifier le calendrier."
    if (studentsQuery.isError) return "Impossible de charger les élèves de cette classe. Réessayez."
    if (!subjectId) return "La matière officielle de ce créneau doit être confirmée par la direction."
    return null
  })()

  const mutation = useMutation({
    mutationFn: () => {
      if (!slot?.date || !gradingPeriod || !subjectId) throw new Error("Créneau de cours indisponible")
      return createSpontaneousGrade({
        lessonSlotId: slot.id,
        subjectId,
        classId: slot.class_id,
        gradingPeriodId: gradingPeriod.id,
        evaluationDate: toEvaluationDate(slot),
        studentId,
        adjustment: parsedAdjustment,
        comment: comment.trim(),
      })
    },
    onSuccess: async () => {
      if (gradingPeriod) await invalidateAcademicReportScope(queryClient, classId, gradingPeriod.id)
      setStudentId("")
      setAdjustment("0")
      setComment("")
      onOpenChange(false)
      toast({ title: "Note spontanée enregistrée" })
    },
    onError: (error) => toast({
      title: "Enregistrement impossible",
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-xl overflow-y-auto rounded-lg sm:w-full">
        <DialogHeader>
          <DialogTitle>Note spontanée</DialogTitle>
          <DialogDescription>
            {slot ? `${slot.subject_name} · ${slot.class_name} · ${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}` : "Cours concerné"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Ajoutez ou retirez des points avec un justificatif obligatoire.</p>
          {entryPeriodQuery.isLoading || studentsQuery.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement des informations du cours…</p> : null}
          {unavailableReason ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{unavailableReason}</p> : null}
          <div className="space-y-2">
            <Label>Élève</Label>
            <Select disabled={Boolean(unavailableReason)} value={studentId || "none"} onValueChange={(value) => setStudentId(value === "none" ? "" : value)}>
              <SelectTrigger className="min-h-12" aria-label="Élève"><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
              <SelectContent>{(studentsQuery.data?.data ?? []).map((student) => <SelectItem key={student.id} value={student.id}>{student.firstName} {student.lastName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
            <div className="space-y-2"><Label>Ajuster</Label><div className="flex gap-2" aria-label="Ajustement de la note spontanée"><Button type="button" disabled={Boolean(unavailableReason) || parsedAdjustment >= 20} className="min-h-12 min-w-12" aria-label="Ajouter un point" onClick={() => setAdjustment(String(Math.min(20, (Number(adjustment.replace(",", ".")) || 0) + 1)))}><Plus className="h-4 w-4" /></Button><Button type="button" disabled={Boolean(unavailableReason) || parsedAdjustment <= -20} variant="outline" className="min-h-12 min-w-12" aria-label="Retirer un point" onClick={() => setAdjustment(String(Math.max(-20, (Number(adjustment.replace(",", ".")) || 0) - 1)))}><Minus className="h-4 w-4" /></Button></div></div>
            <div className="space-y-2"><Label htmlFor="spontaneous-adjustment">Points</Label><Input id="spontaneous-adjustment" disabled={Boolean(unavailableReason)} type="number" min={-20} max={20} step={0.25} value={adjustment} onChange={(event) => setAdjustment(event.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="spontaneous-comment">Justificatif</Label><Input id="spontaneous-comment" disabled={Boolean(unavailableReason)} value={comment} placeholder="Bonne réponse, participation, perturbation…" onChange={(event) => setComment(event.target.value)} /></div>
        </div>
        <DialogFooter><Button type="button" className="min-h-12" disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
