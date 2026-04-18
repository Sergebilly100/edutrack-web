import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import QRScanner from "@/modules/attendance/QRScanner"
import { teacherScheduleApi, type ScheduleSlot } from "@/modules/attendance/attendance.api"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

type StudentRollCallStatus = "unmarked" | "present" | "absent"

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
  // Map studentId → "unmarked" | "present" | "absent"
  // Par défaut tous non-marqués (ni présent ni absent)
  const [studentStatuses, setStudentStatuses] = useState<Map<string, StudentRollCallStatus>>(new Map())
  // Contrôle la modale "faire l'appel maintenant ?"
  const [showRollCallPrompt, setShowRollCallPrompt] = useState(false)

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
      setStudentStatuses(new Map())
      setShowRollCallPrompt(false)
    }
  }, [open, slot.id])

  const checkInMutation = useOfflineMutation(
    teacherScheduleApi.checkIn,
    { queueKey: "attendance-checkin" }
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

  // Calcul des compteurs à partir des statuts
  const { absentCount, presentCount, unmarkedCount } = useMemo(() => {
    let absent = 0
    let present = 0
    let unmarked = 0
    for (const status of studentStatuses.values()) {
      if (status === "absent") absent++
      else if (status === "present") present++
      else unmarked++
    }
    return { absentCount: absent, presentCount: present, unmarkedCount: unmarked }
  }, [studentStatuses])

  // Initialiser les statuts quand la liste charge (tous unmarked)
  useEffect(() => {
    if (studentsQuery.data) {
      setStudentStatuses(
        new Map(studentsQuery.data.map((s) => [s.id, "unmarked" as StudentRollCallStatus]))
      )
    }
  }, [studentsQuery.data])

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
              : "Mode hors ligne : synchronisation auto.",
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
    if (!qrToken) return

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
      toast({ title: "Salle vérifiée", description: "Le scan QR est validé." })

      await wait(800)
      // Après le scan, afficher la modale "appel maintenant ou plus tard ?"
      setShowRollCallPrompt(true)
    } catch {
      toast({
        title: "Scan QR invalide",
        description: "Le code saisi ou scanné est invalide.",
        variant: "destructive",
      })
    }
  }

  const handleRollCallNow = () => {
    setShowRollCallPrompt(false)
    setStep(3)
  }

  const handleRollCallLater = () => {
    setShowRollCallPrompt(false)
    toast({
      title: "Appel reporté",
      description: `Pensez à faire l'appel avant ${formatTime(slot.end_time)}.`,
    })
    onClose()
  }

  const markStudent = (studentId: string, status: StudentRollCallStatus) => {
    setStudentStatuses((prev) => {
      const next = new Map(prev)
      // Toggle : si on reclique sur le même bouton déjà actif → retour à "unmarked"
      next.set(studentId, prev.get(studentId) === status ? "unmarked" : status)
      return next
    })
  }

  const handleSubmitStudents = async () => {
    const students = studentsQuery.data ?? []
    const absentStudentIds = students
      .filter((s) => studentStatuses.get(s.id) === "absent")
      .map((s) => s.id)

    // Les élèves non marqués sont traités comme présents côté backend
    // (le prof n'a pas explicitement marqué leur absence)
    try {
      await submitStudentsMutation.mutateAsync({
        schedule_id: slot.id,
        date: attendanceDate,
        absent_student_ids: absentStudentIds,
      })

      toast({
        title: `Appel enregistré — ${absentCount} absent(s)`,
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
    <>
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

          {/* Indicateur d'étapes */}
          <div className="flex items-center justify-between gap-2 py-1">
            {stepIndex.map((item) => {
              const completed = item < step
              const current = item === step
              return (
                <div key={item} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors duration-200",
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

          {/* ── Étape 1 — Pointage prof ─────────────────────────────────────── */}
          {step === 1 ? (
            <section className="space-y-4 rounded-xl border p-4" data-testid="teacher-checkin-step-1">
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Matière :</span> {slot.subject_name}</p>
                <p><span className="font-medium">Classe :</span> {slot.class_name}</p>
                <p><span className="font-medium">Heure :</span> {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p>
              </div>

              {checkInMutation.isSuccess ? (
                <Badge className="bg-green-600 text-white hover:bg-green-600">
                  {lateMinutes && lateMinutes > 0 ? `En retard — ${lateMinutes}min` : "Pointage enregistré"}
                </Badge>
              ) : null}

              <Button
                type="button"
                size="lg"
                className="w-full min-h-[72px] active:scale-95 transition-transform"
                data-testid="teacher-checkin-submit"
                disabled={checkInMutation.isPending}
                onClick={() => { void handleCheckIn() }}
              >
                {checkInMutation.isPending ? "Enregistrement..." : "Je suis présent(e)"}
              </Button>
            </section>
          ) : null}

          {/* ── Étape 2 — Scan QR ──────────────────────────────────────────── */}
          {step === 2 ? (
            <section className="space-y-4 rounded-xl border p-4" data-testid="teacher-checkin-step-2">
              <QRScanner
                scheduleId={slot.id}
                scanType="start"
                onTokenDetected={(token) => { void handleQrSubmit(token) }}
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
                    className="min-h-[48px]"
                    data-testid="teacher-checkin-manual-qr-submit"
                    disabled={qrMutation.isPending}
                    onClick={() => { void handleQrSubmit(manualQrCode) }}
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
                onClick={() => setShowRollCallPrompt(true)}
              >
                Passer cette étape
              </Button>
            </section>
          ) : null}

          {/* ── Étape 3 — Appel élèves ─────────────────────────────────────── */}
          {step === 3 ? (
            <section className="space-y-4 rounded-xl border p-4" data-testid="teacher-checkin-step-3">
              {/* Compteurs rapides */}
              <div className="flex gap-2">
                <span className="flex items-center gap-1.5 rounded-md bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  {presentCount} présent{presentCount > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {absentCount} absent{absentCount > 1 ? "s" : ""}
                </span>
                {unmarkedCount > 0 ? (
                  <span className="flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {unmarkedCount} non marqué{unmarkedCount > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>

              {studentsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-[52px] w-full rounded-xl" />
                  ))}
                </div>
              ) : null}

              {!studentsQuery.isLoading && !studentsQuery.data?.length ? (
                <Alert>
                  <AlertDescription>Aucun élève trouvé pour cette classe.</AlertDescription>
                </Alert>
              ) : null}

              {studentsQuery.data?.length ? (
                <div
                  className="max-h-[40vh] space-y-2 overflow-y-auto pr-1"
                  data-testid="teacher-student-list"
                >
                  {studentsQuery.data.map((student) => {
                    const status = studentStatuses.get(student.id) ?? "unmarked"
                    const isPresent = status === "present"
                    const isAbsent = status === "absent"

                    return (
                      <div
                        key={student.id}
                        data-testid={`teacher-student-row-${student.id}`}
                        className={cn(
                          "flex min-h-[52px] items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors duration-200",
                          isPresent && "border-green-200 bg-green-50",
                          isAbsent && "border-red-200 bg-red-50",
                          !isPresent && !isAbsent && "border-border bg-card"
                        )}
                      >
                        {/* Nom de l'élève */}
                        <span
                          className={cn(
                            "flex-1 text-sm font-medium",
                            isPresent && "text-green-800",
                            isAbsent && "text-red-800",
                            !isPresent && !isAbsent && "text-foreground"
                          )}
                        >
                          {student.full_name}
                        </span>

                        {/* Boutons Présent / Absent */}
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            data-testid={`teacher-student-present-${student.id}`}
                            className={cn(
                              "min-h-[40px] min-w-[72px] rounded-lg border text-xs font-semibold transition-all duration-150 active:scale-95",
                              isPresent
                                ? "border-green-300 bg-green-100 text-green-700 hover:bg-green-200"
                                : "border-border text-muted-foreground hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                            )}
                            onClick={() => markStudent(student.id, "present")}
                          >
                            ✓ Présent
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            data-testid={`teacher-student-absent-${student.id}`}
                            className={cn(
                              "min-h-[40px] min-w-[68px] rounded-lg border text-xs font-semibold transition-all duration-150 active:scale-95",
                              isAbsent
                                ? "border-red-300 bg-red-100 text-red-700 hover:bg-red-200"
                                : "border-border text-muted-foreground hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                            )}
                            onClick={() => markStudent(student.id, "absent")}
                          >
                            ✕ Absent
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              <Button
                type="button"
                size="lg"
                className="w-full min-h-[56px]"
                data-testid="teacher-students-submit"
                disabled={submitStudentsMutation.isPending}
                onClick={() => { void handleSubmitStudents() }}
              >
                {submitStudentsMutation.isPending
                  ? "Envoi en cours..."
                  : `Terminer l'appel — ${absentCount} absent${absentCount > 1 ? "s" : ""}`}
              </Button>
            </section>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ── Modale "Faire l'appel maintenant ou plus tard ?" ───────────────── */}
      <AlertDialog open={showRollCallPrompt} onOpenChange={setShowRollCallPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Faire l'appel maintenant ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous pouvez faire l'appel des élèves maintenant ou le reporter à plus tard.
              {"\n\n"}
              <span className="font-medium text-amber-700">
                ⚠ L'appel doit être effectué avant la fin du cours ({formatTime(slot.end_time)}).
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleRollCallLater}>
              Non, plus tard
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRollCallNow}>
              Oui, maintenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
