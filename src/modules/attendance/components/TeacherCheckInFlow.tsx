import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import QRScanner from "@/modules/attendance/QRScanner"
import { teacherScheduleApi, type ScheduleSlot } from "@/modules/attendance/attendance.api"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { useOfflineMutation } from "@/shared/hooks/useOfflineMutation"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import { CheckIcon } from "@/shared/components/icons"
import { cn } from "@/lib/utils"

interface TeacherCheckInFlowProps {
  open: boolean
  onClose: () => void
  slot: ScheduleSlot
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":")
  return `${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}`
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export default function TeacherCheckInFlow({ open, onClose, slot }: TeacherCheckInFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [lateMinutes, setLateMinutes] = useState<number | null>(null)
  const [manualQrCode, setManualQrCode] = useState("")
  const [qrWarning, setQrWarning] = useState<string | null>(null)
  const [qrValidated, setQrValidated] = useState(false)
  const [absentStudentIds, setAbsentStudentIds] = useState<Set<string>>(new Set())

  const { toast } = useToast()
  const { isOnline } = useNetworkStatus()
  const queryClient = useQueryClient()

  const attendanceDate = slot.date ?? toDateKey(new Date())

  useEffect(() => {
    if (!open) {
      setStep(1)
      setLateMinutes(null)
      setManualQrCode("")
      setQrWarning(null)
      setQrValidated(false)
      setAbsentStudentIds(new Set())
    }
  }, [open, slot.id])

  const checkInMutation = useOfflineMutation(
    teacherScheduleApi.checkIn,
    {
      queueKey: "attendance-checkin",
    }
  )

  const qrMutation = useMutation({
    mutationFn: teacherScheduleApi.scanQr,
  })

  const studentsQuery = useQuery({
    queryKey: ["students", slot.class_id],
    queryFn: () => teacherScheduleApi.getStudentsByClass(slot.class_id),
    enabled: open && step === 3,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })

  const submitStudentsMutation = useMutation({
    mutationFn: teacherScheduleApi.submitStudentAttendance,
  })

  const absentCount = absentStudentIds.size

  const handleCheckIn = async () => {
    try {
      const result = await checkInMutation.mutateAsync({
        schedule_id: slot.id,
        date: attendanceDate,
      })

      const resolvedLateMinutes = result?.late_minutes ?? null
      setLateMinutes(resolvedLateMinutes)

      toast({
        title: "Pointage enregistré",
        description:
          resolvedLateMinutes && resolvedLateMinutes > 0
            ? `En retard de ${resolvedLateMinutes} min.`
            : isOnline
              ? "Présence confirmée."
              : "Mode hors ligne: le pointage sera synchronisé automatiquement.",
      })

      await wait(1500)
      setStep(2)
    } catch {
      toast({
        title: "Échec du pointage",
        description: "Impossible d'enregistrer votre présence pour le moment.",
        variant: "destructive",
      })
    }
  }

  const handleQrSubmit = async (token: string) => {
    const qrToken = token.trim()
    if (!qrToken) {
      return
    }

    try {
      const response = await qrMutation.mutateAsync({
        qr_token: qrToken,
        scan_type: "start",
        schedule_id: slot.id,
      })

      if (response.room_mismatch) {
        setQrWarning("Vous n'êtes pas dans la bonne salle.")
      } else {
        setQrWarning(null)
      }

      setQrValidated(true)
      toast({
        title: "Salle vérifiée",
        description: "Le scan QR est validé.",
      })

      await wait(800)
      setStep(3)
    } catch {
      toast({
        title: "Scan QR invalide",
        description: "Le code saisi ou scanné est invalide.",
        variant: "destructive",
      })
    }
  }

  const toggleStudent = (studentId: string, presentChecked: boolean) => {
    setAbsentStudentIds((previous) => {
      const next = new Set(previous)

      if (presentChecked) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }

      return next
    })
  }

  const handleSubmitStudents = async () => {
    try {
      await submitStudentsMutation.mutateAsync({
        schedule_id: slot.id,
        date: attendanceDate,
        absent_student_ids: [...absentStudentIds],
      })

      toast({
        title: `Appel enregistré, ${absentCount} absent(s) notifié(s)`,
      })

      void queryClient.invalidateQueries({ queryKey: ["teacher-attendance", attendanceDate] })
      onClose()
    } catch {
      toast({
        title: "Échec de l'appel",
        description: "Impossible d'envoyer la liste des absents.",
        variant: "destructive",
      })
    }
  }

  const stepIndex = useMemo(() => [1, 2, 3] as const, [])

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : onClose())}>
      <SheetContent
        side="bottom"
        data-testid="teacher-checkin-flow"
        className="max-h-[92vh] space-y-4 overflow-y-auto rounded-t-2xl px-4 pb-6 pt-4 md:mx-auto md:max-w-3xl"
      >
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle>Pointage du cours</SheetTitle>
          <SheetDescription>
            {slot.subject_name} - {slot.class_name} ({formatTime(slot.start_time)} - {formatTime(slot.end_time)})
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between gap-2 py-1">
          {stepIndex.map((item) => {
            const completed = item < step
            const current = item === step

            return (
              <div key={item} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
                    current && "bg-primary text-primary-foreground",
                    completed && "bg-green-100 text-green-700",
                    !current && !completed && "bg-muted text-muted-foreground"
                  )}
                >
                  {completed ? <CheckIcon className="h-4 w-4" /> : item}
                </div>
                {item < 3 ? <div className="h-px flex-1 bg-border" /> : null}
              </div>
            )
          })}
        </div>

        {step === 1 ? (
          <section className="space-y-4 rounded-xl border p-4" data-testid="teacher-checkin-step-1">
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Matière :</span> {slot.subject_name}
              </p>
              <p>
                <span className="font-medium">Classe :</span> {slot.class_name}
              </p>
              <p>
                <span className="font-medium">Heure :</span> {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
              </p>
            </div>

            {checkInMutation.isSuccess ? (
              <Badge className="bg-green-600 text-white hover:bg-green-600">
                {lateMinutes && lateMinutes > 0 ? `En retard - ${lateMinutes}min` : "Pointage enregistré"}
              </Badge>
            ) : null}

            <Button
              type="button"
              size="lg"
              className="w-full"
              data-testid="teacher-checkin-submit"
              disabled={checkInMutation.isPending}
              onClick={() => {
                void handleCheckIn()
              }}
            >
              {checkInMutation.isPending ? "Enregistrement..." : "Je suis présent(e)"}
            </Button>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4 rounded-xl border p-4" data-testid="teacher-checkin-step-2">
            <QRScanner
              scheduleId={slot.id}
              scanType="start"
              onTokenDetected={(token) => {
                void handleQrSubmit(token)
              }}
            />

            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">Entrer le code manuellement</p>
              <div className="flex gap-2">
                <Input
                  value={manualQrCode}
                  onChange={(event) => setManualQrCode(event.target.value)}
                  placeholder="Code QR"
                  data-testid="teacher-checkin-manual-qr-input"
                />
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="teacher-checkin-manual-qr-submit"
                  disabled={qrMutation.isPending}
                  onClick={() => {
                    void handleQrSubmit(manualQrCode)
                  }}
                >
                  Valider
                </Button>
              </div>
            </div>

            {qrWarning ? (
              <Alert className="border-amber-300 bg-amber-50 text-amber-800">
                <AlertDescription>{qrWarning}</AlertDescription>
              </Alert>
            ) : null}

            {qrValidated ? (
              <Badge className="bg-green-600 text-white hover:bg-green-600">Salle vérifiée</Badge>
            ) : null}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              data-testid="teacher-checkin-skip-qr"
              onClick={() => setStep(3)}
            >
              Passer cette étape
            </Button>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4 rounded-xl border p-4" data-testid="teacher-checkin-step-3">
            {studentsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : null}

            {!studentsQuery.isLoading && !studentsQuery.data?.length ? (
              <Alert>
                <AlertDescription>Aucun élève trouvé pour cette classe.</AlertDescription>
              </Alert>
            ) : null}

            {studentsQuery.data?.length ? (
              <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1" data-testid="teacher-student-list">
                {studentsQuery.data.map((student) => {
                  const isPresent = !absentStudentIds.has(student.id)

                  return (
                    <label
                      key={student.id}
                      data-testid={`teacher-student-row-${student.id}`}
                      className="flex min-h-[48px] items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <Checkbox
                        data-testid={`teacher-student-checkbox-${student.id}`}
                        checked={isPresent}
                        onCheckedChange={(value) => toggleStudent(student.id, Boolean(value))}
                      />
                      <span className="text-sm">{student.full_name}</span>
                    </label>
                  )
                })}
              </div>
            ) : null}

            <Button
              type="button"
              size="lg"
              className="w-full"
              data-testid="teacher-students-submit"
              disabled={submitStudentsMutation.isPending}
              onClick={() => {
                void handleSubmitStudents()
              }}
            >
              {submitStudentsMutation.isPending ? "Envoi..." : "Terminer l'appel"}
            </Button>
          </section>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
