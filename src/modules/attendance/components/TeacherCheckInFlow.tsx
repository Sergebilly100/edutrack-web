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
import { useRollCallStore } from "@/shared/store/rollCall.store"
import { AbsentIcon, CheckIcon, PresentIcon } from "@/shared/components/icons"
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

const motivationalMessages = [
  "Le directeur verra que vous faites partie des meilleurs de l'équipe",
  "Votre sérieux est valorisé. Terminez le cours pour le confirmer",
  "Les profs qui scannent la fin sont prioritaires lors des renouvellements",
  "Votre taux de conformité est visible par la direction. Gardez le cap",
]

const randomMotivationalMessage =
  motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)]

const getGeoPosition = async (enabled: boolean) => {
  if (!enabled || !("geolocation" in navigator)) {
    return {}
  }

  return new Promise<{ latitude?: number; longitude?: number; accuracy?: number }>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  })
}

export const shouldMarkCheckinQrDoneOnSheetClose = ({
  step,
  isRollCallPending,
  isReadyToFinish,
}: {
  step: 1 | 2 | 3 | 4
  isRollCallPending: boolean
  isReadyToFinish: boolean
}) => step === 3 && !isRollCallPending && !isReadyToFinish

export default function TeacherCheckInFlow({ open, onClose, slot }: TeacherCheckInFlowProps) {
  const attendanceDate = slot.date ?? toDateKey(new Date())

  const rollCallStore = useRollCallStore()
  const flowState = rollCallStore.getFlowState(slot.id, attendanceDate)
  const isRollCallPending = flowState === "rollcall_pending"
  const isCheckinQrDone = flowState === "checkin_qr_done"
  const isReadyToFinish = flowState === "ready_to_finish"

  /**
   * Étape de départ selon l'état du flow :
   * - rollcall_pending  → directement à l'étape 3 (appel)
   * - checkin_qr_done   → reprend à l'étape 3 (même comportement que pending)
   * - null (nouveau)    → étape 1
   */
  const initialStep: 1 | 2 | 3 | 4 =
    isReadyToFinish ? 4 : isRollCallPending || isCheckinQrDone ? 3 : 1

  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep)

  /**
   * Point 4 — La présence n'est confirmée qu'après l'étape 2 (QR).
   * On stocke les données de check-in localement jusqu'à la validation QR.
   * checkInScheduled = true signifie que le prof a cliqué "Je suis présent(e)"
   * mais que la mutation n'a pas encore été envoyée au backend.
   */
  const [checkInScheduled, setCheckInScheduled] = useState(false)
  const [lateMinutes, setLateMinutes] = useState<number | null>(null)
  const [manualQrCode, setManualQrCode] = useState("")
  const [qrWarning, setQrWarning] = useState<string | null>(null)
  const [qrValidated, setQrValidated] = useState(false)
  const [studentStatuses, setStudentStatuses] = useState<Map<string, StudentRollCallStatus>>(
    new Map()
  )
  const [showRollCallPrompt, setShowRollCallPrompt] = useState(false)

  const { toast } = useToast()
  const { isOnline } = useNetworkStatus()
  const queryClient = useQueryClient()

  // Reset à la fermeture
  useEffect(() => {
    if (!open) {
      setLateMinutes(null)
      setManualQrCode("")
      setQrWarning(null)
      setQrValidated(false)
      setStudentStatuses(new Map())
      setShowRollCallPrompt(false)
      setCheckInScheduled(false)
      const currentFlow = rollCallStore.getFlowState(slot.id, attendanceDate)
      if (currentFlow === "ready_to_finish") {
        setStep(4)
      } else {
        setStep(currentFlow === "rollcall_pending" || currentFlow === "checkin_qr_done" ? 3 : 1)
      }
    }
  }, [open, slot.id, attendanceDate, rollCallStore])

  const checkInMutation = useOfflineMutation(teacherScheduleApi.checkIn, {
    queueKey: "attendance-checkin",
  })

  const qrMutation = useMutation({ mutationFn: teacherScheduleApi.scanQr })

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
  const qrSkipMutation = useOfflineMutation(teacherScheduleApi.skipQr, {
    queueKey: "attendance-qr-skip",
  })
  const attendancePolicyQuery = useQuery({
    queryKey: ["attendance-policy", "teacher"],
    queryFn: teacherScheduleApi.getTeacherAttendancePolicy,
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: "always",
  })
  const canSkipQrStep = attendancePolicyQuery.data?.allow_teacher_qr_skip ?? false
  const geoCheckEnabled = attendancePolicyQuery.data?.geo_check_enabled ?? false
  const motivationalMessage = randomMotivationalMessage

  const { absentCount, presentCount, unmarkedCount } = useMemo(() => {
    let absent = 0; let present = 0; let unmarked = 0
    for (const s of studentStatuses.values()) {
      if (s === "absent") absent++
      else if (s === "present") present++
      else unmarked++
    }
    return { absentCount: absent, presentCount: present, unmarkedCount: unmarked }
  }, [studentStatuses])

  // Tous les élèves marqués = présents + absents = total
  const totalStudents = studentsQuery.data?.length ?? 0
  const allStudentsMarked = totalStudents > 0 && unmarkedCount === 0

  useEffect(() => {
    if (studentsQuery.data) {
      setStudentStatuses(
        new Map(studentsQuery.data.map((s) => [s.id, "unmarked" as StudentRollCallStatus]))
      )
    }
  }, [studentsQuery.data])

  // ── Étape 1 — Le prof indique sa présence (local uniquement) ─────────────
  /**
   * Point 4 : on ne fait PAS encore la mutation vers le backend ici.
   * On marque juste l'intention localement → passage à l'étape 2.
   * La mutation réelle se fait dans handleQrSuccess après validation QR.
   */
  const handleCheckIn = async () => {
    setCheckInScheduled(true)
    toast({
      title: "Présence notée",
      description: "Scannez maintenant le QR code de votre salle pour confirmer.",
    })
    await wait(800)
    setStep(2)
  }

  // ── Étape 2 — Scan QR + envoi checkIn vers backend ───────────────────────
  /**
   * Point 4 : c'est ici que la présence est réellement confirmée.
   * On chaîne : checkIn (backend) → qrScan (backend) → résultat.
   */
  const handleQrSubmit = async (token: string) => {
    const qrToken = token.trim()
    if (!qrToken) return

    try {
      // ── 1. Envoyer le checkIn au backend (présence confirmée) ──
      const geo = await getGeoPosition(geoCheckEnabled)
      const checkInResult = await checkInMutation.mutateAsync({
        schedule_id: slot.id,
        date: attendanceDate,
        ...geo,
      })
      const resolvedLateMinutes = checkInResult?.late_minutes ?? null
      setLateMinutes(resolvedLateMinutes)

      // ── 2. Valider le scan QR ──
      const qrResult = await qrMutation.mutateAsync({
        qr_token: qrToken,
        scan_type: "start",
        schedule_id: slot.id,
      })

      setQrWarning(qrResult.room_mismatch ? "Vous n'êtes pas dans la bonne salle." : null)
      setQrValidated(true)

      const lateMsg =
        resolvedLateMinutes && resolvedLateMinutes > 0
          ? ` En retard de ${resolvedLateMinutes} min.`
          : ""

      toast({
        title: "Présence confirmée",
        description: `Salle vérifiée.${lateMsg}${!isOnline ? " (hors ligne, sync auto)" : ""}`,
      })

      await wait(800)
      setShowRollCallPrompt(true)
    } catch {
      toast({
        title: "Validation impossible",
        description: "Impossible de confirmer votre présence ou de valider la salle. Réessayez dans quelques instants.",
        variant: "destructive",
      })
    }
  }

  // Passer l'étape QR sans scanner (bouton "Passer cette étape")
  const handleSkipQr = async () => {
    if (!canSkipQrStep) {
      return
    }

    // Le prof saute le QR : on envoie quand même le checkIn si pas encore fait
    if (checkInScheduled && !checkInMutation.isSuccess) {
      try {
        const result = await checkInMutation.mutateAsync({
          schedule_id: slot.id,
          date: attendanceDate,
        })
        setLateMinutes(result?.late_minutes ?? null)
      } catch {
        toast({
          title: "Pointage non enregistré",
          description: "Le pointage sera synchronisé automatiquement.",
          variant: "destructive",
        })
      }
    }

    try {
      await qrSkipMutation.mutateAsync({
        scan_type: "start",
        schedule_id: slot.id,
        date: attendanceDate,
      })
      setQrWarning(null)
      setQrValidated(true)
    } catch {
      toast({
        title: "Validation sans QR impossible",
        description: "Impossible de confirmer la salle sans QR pour le moment.",
        variant: "destructive",
      })
      return
    }

    setShowRollCallPrompt(true)
  }

  // ── Modale appel maintenant / plus tard ──────────────────────────────────

  const handleRollCallNow = () => {
    setShowRollCallPrompt(false)
    setStep(3)
  }

  const handleRollCallLater = () => {
    setShowRollCallPrompt(false)
    rollCallStore.markRollCallPending(slot.id, attendanceDate)
    toast({
      title: "Appel reporté",
      description: `Pensez à faire le pointage avant ${formatTime(slot.end_time)}.`,
    })
    onClose()
  }

  /**
   * Point 5 — Fermeture du sheet AVANT la fin du process.
   * On marque "checkin_qr_done" uniquement si l'enseignant est déjà entré
   * dans l'étape d'appel (étape 3) puis ferme le sheet sans terminer.
   * CourseCard affichera "Poursuivre le pointage".
   */
  const handleSheetClose = () => {
    if (step === 4 || isReadyToFinish) {
      onClose()
      return
    }

    if (shouldMarkCheckinQrDoneOnSheetClose({ step, isRollCallPending, isReadyToFinish })) {
      rollCallStore.markCheckinQrDone(slot.id, attendanceDate)
    }
    // Si rollcall_pending déjà dans le store → laisser tel quel
    onClose()
  }

  // ── Étape 3 — Appel élèves ────────────────────────────────────────────────

  const markStudent = (studentId: string, status: StudentRollCallStatus) => {
    setStudentStatuses((prev) => {
      const next = new Map(prev)
      next.set(studentId, prev.get(studentId) === status ? "unmarked" : status)
      return next
    })
  }

  const handleSubmitStudents = async () => {
    /**
     * Point 3 — Impossible d'envoyer si des élèves sont encore "unmarked".
     * Le bouton est désactivé si unmarkedCount > 0, mais on double-vérifie ici.
     */
    if (unmarkedCount > 0) {
      toast({
        title: "Appel incomplet",
        description: `${unmarkedCount} élève${unmarkedCount > 1 ? "s" : ""} non marqué${unmarkedCount > 1 ? "s" : ""}. Marquez tous les élèves avant de valider.`,
        variant: "destructive",
      })
      return
    }

    const students = studentsQuery.data ?? []
    const absentStudentIds = students
      .filter((s) => studentStatuses.get(s.id) === "absent")
      .map((s) => s.id)

    try {
      await submitStudentsMutation.mutateAsync({
        schedule_id: slot.id,
        date: attendanceDate,
        absent_student_ids: absentStudentIds,
      })

      rollCallStore.markReadyToFinish(slot.id, attendanceDate)
      toast({
        title: `Appel enregistré — ${absentCount} absent(s)`,
        description: "Terminez le cours à la fin pour confirmer les heures effectuées.",
      })
      void queryClient.invalidateQueries({ queryKey: ["teacher-attendance", attendanceDate] })
      onClose()
    } catch {
      toast({
        title: "Appel non envoyé",
        description: "Impossible d'envoyer la liste des absents. Vérifiez la connexion, puis réessayez.",
        variant: "destructive",
      })
    }
  }

  const finishCourseMutation = useMutation({ mutationFn: teacherScheduleApi.checkOut })

  const handleFinishCourse = async () => {
    try {
      const geo = await getGeoPosition(geoCheckEnabled)
      const result = await finishCourseMutation.mutateAsync({
        schedule_id: slot.id,
        date: attendanceDate,
        ...geo,
      })

      rollCallStore.markDone(slot.id, attendanceDate) // Marquer comme done
      toast({
        title: "Cours terminé",
        description: `${result.actual_minutes} min enregistrées.`,
      })
      void queryClient.invalidateQueries({ queryKey: ["teacher-attendance", attendanceDate] })
      onClose()
    } catch {
      toast({
        title: "Clôture impossible",
        description: "Impossible d'enregistrer la fin du cours. Réessayez avant de quitter la salle.",
        variant: "destructive",
      })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const stepIndex = useMemo(() => [1, 2, 3] as const, [])
  const isResuming = isRollCallPending || isCheckinQrDone || isReadyToFinish

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleSheetClose()
        }}
      >
        <SheetContent
          side="bottom"
          data-testid="teacher-checkin-flow"
          className="max-h-[92vh] space-y-4 overflow-y-auto rounded-t-2xl px-4 pb-6 pt-4 md:mx-auto md:max-w-3xl"
        >
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle>
              {isRollCallPending
                ? "Pointage des élèves"
                : isReadyToFinish
                  ? "Terminer le cours"
                : isCheckinQrDone
                  ? "Poursuivre le pointage"
                  : "Pointage du cours"}
            </SheetTitle>
            <SheetDescription>
              {slot.subject_name} - {slot.class_name} ({formatTime(slot.start_time)} -{" "}
              {formatTime(slot.end_time)})
            </SheetDescription>
          </SheetHeader>

          {/* Indicateur d'étapes — masqué en mode reprise */}
          {!isResuming ? (
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
                      <span className="sr-only">
                        {item === 1 ? "Présence" : item === 2 ? "Salle" : "Appel élèves"}
                      </span>
                      {completed ? <CheckIcon className="h-4 w-4" /> : item}
                    </div>
                    {item < 3 ? <div className="h-px flex-1 bg-border" /> : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          {/* ── Step 1 — Déclaration de présence (local) ────────────────── */}
          {step === 1 ? (
            <section
              className="space-y-4 rounded-xl border p-2"
              data-testid="teacher-checkin-step-1"
            >
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Matière :</span> {slot.subject_name}</p>
                <p><span className="font-medium">Classe :</span> {slot.class_name}</p>
                <p>
                  <span className="font-medium">Heure :</span> {formatTime(slot.start_time)} -{" "}
                  {formatTime(slot.end_time)}
                </p>
              </div>

              {/* Note explicative sur le process 2 étapes */}
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Votre présence sera confirmée après la vérification de la salle.
              </p>

              <Button
                type="button"
                size="lg"
                className="w-full min-h-[72px] active:scale-95 transition-transform"
                data-testid="teacher-checkin-submit"
                disabled={checkInScheduled}
                onClick={() => { void handleCheckIn() }}
              >
                {checkInScheduled ? "Prêt pour le QR" : "Je suis présent(e)"}
              </Button>
            </section>
          ) : null}

          {/* ── Step 2 — Scan QR + confirmation présence ────────────────── */}
          {step === 2 ? (
            <section
              className="space-y-4 rounded-xl border p-2"
              data-testid="teacher-checkin-step-2"
            >
              {/* Rappel : le check-in sera envoyé ICI */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                <p className="text-xs font-medium text-blue-800">
                  Scannez le QR code de la salle pour confirmer votre présence.
                </p>
              </div>

              <QRScanner
                scheduleId={slot.id}
                scanType="start"
                onTokenDetected={(token) => { void handleQrSubmit(token) }}
              />

              <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                <p className="text-sm font-medium text-amber-800">Entrer le code manuellement</p>
                <div className="flex gap-2">
                  <Input
                    value={manualQrCode}
                    onChange={(e) => setManualQrCode(e.target.value)}
                    placeholder="Code QR"
                    data-testid="teacher-checkin-manual-qr-input"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-[35px] p-1"
                    data-testid="teacher-checkin-manual-qr-submit"
                    disabled={checkInMutation.isPending || qrMutation.isPending}
                    onClick={() => { void handleQrSubmit(manualQrCode) }}
                  >
                    {checkInMutation.isPending || qrMutation.isPending ? "Validation..." : "Valider"}
                  </Button>
                </div>
              </div>

              {qrWarning ? (
                <Alert className="border-amber-300 bg-amber-50 text-amber-800">
                  <AlertDescription>{qrWarning}</AlertDescription>
                </Alert>
              ) : null}

              {qrValidated ? (
                <Badge className="bg-green-600 text-white hover:bg-green-600">
                  {lateMinutes && lateMinutes > 0
                    ? `Présence confirmée — retard ${lateMinutes}min`
                    : "Présence confirmée"}
                </Badge>
              ) : null}

              {canSkipQrStep ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-primary"
                  data-testid="teacher-checkin-skip-qr"
                  disabled={checkInMutation.isPending || qrSkipMutation.isPending}
                  onClick={() => { void handleSkipQr() }}
                >
                  Valider sans QR
                </Button>
              ) : null}
            </section>
          ) : null}

          {/* ── Step 3 — Appel élèves ────────────────────────────────────── */}
          {step === 3 ? (
            <section
              className="space-y-4 rounded-xl border p-2"
              data-testid="teacher-checkin-step-3"
            >
              {/* Compteurs */}
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  {presentCount} présent{presentCount > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {absentCount} absent{absentCount > 1 ? "s" : ""}
                </span>
                {unmarkedCount > 0 ? (
                  <span className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {unmarkedCount} à marquer
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    Tous les élèves sont marqués
                  </span>
                )}
              </div>

              {studentsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-[52px] w-full rounded-xl" />
                  ))}
                </div>
              ) : null}

              {!studentsQuery.isLoading && !studentsQuery.data?.length ? (
                <Alert>
                  <AlertDescription>Aucun élève trouvé pour cette classe. Vérifiez la liste des élèves avant de valider l'appel.</AlertDescription>
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
                          "flex min-h-[52px] items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors duration-150",
                          isPresent && "border-green-200 bg-green-50",
                          isAbsent && "border-red-200 bg-red-50",
                          !isPresent && !isAbsent && "border-amber-200 bg-amber-50/60"
                        )}
                      >
                        <span
                          className={cn(
                            "flex-1 text-sm font-medium",
                            isPresent && "text-green-800",
                            isAbsent && "text-red-800",
                            !isPresent && !isAbsent && "text-amber-800"
                          )}
                        >
                          {student.full_name}
                        </span>

                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            data-testid={`teacher-student-present-${student.id}`}
                            className={cn(
                              "min-h-[40px] min-w-[72px] rounded-lg border text-xs font-semibold transition-all duration-150 active:scale-95 dark:text-black",
                              isPresent
                                ? "border-green-300 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-700 dark:text-green-300 dark:hover:bg-green-600"
                                : "border-border text-muted-foreground hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                            )}
                            onClick={() => markStudent(student.id, "present")}
                          >
                            <PresentIcon className="mr-1 h-3.5 w-3.5" />
                            Présent
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            data-testid={`teacher-student-absent-${student.id}`}
                            className={cn(
                              "min-h-[40px] min-w-[68px] rounded-lg border text-xs font-semibold transition-all duration-150 active:scale-95 dark:text-black",
                              isAbsent
                                ? "border-red-300 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-700 dark:text-red-300 dark:hover:bg-red-600"
                                : "border-border text-muted-foreground hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                            )}
                            onClick={() => markStudent(student.id, "absent")}
                          >
                            <AbsentIcon className="mr-1 h-3.5 w-3.5" />
                            Absent
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {/* Point 3 — Bouton désactivé tant que tous les élèves ne sont pas marqués */}
              <Button
                type="button"
                size="lg"
                className="w-full min-h-[56px]"
                data-testid="teacher-students-submit"
                disabled={submitStudentsMutation.isPending || !allStudentsMarked}
                onClick={() => { void handleSubmitStudents() }}
              >
                {submitStudentsMutation.isPending
                  ? "Envoi en cours..."
                  : !allStudentsMarked
                    ? `Marquer encore ${unmarkedCount} élève${unmarkedCount > 1 ? "s" : ""}`
                    : `Valider l'appel — ${absentCount} absent${absentCount > 1 ? "s" : ""}`}
              </Button>
            </section>
          ) : null}

          {/* // ── Step 4 — Fin du cours + scan QR ───────────────────────────────── */}
          {step === 4 ? (
            <section className="space-y-4 rounded-xl border p-2" data-testid="teacher-checkin-step-4">
              <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 px-3 py-3">
                <p className="text-sm font-medium text-green-800">
                  Cours en cours : {slot.subject_name} {slot.class_name}
                </p>
                <p className="text-xs text-green-700">
                  Début : {formatTime(slot.start_time)} - Salle {slot.room_name}
                </p>
                <p className="text-xs text-green-700">{motivationalMessage}</p>
              </div>

              <Button
                type="button"
                size="lg"
                className="w-full min-h-[72px] bg-red-600 text-white hover:bg-red-700"
                data-testid="teacher-finish-course-submit"
                disabled={finishCourseMutation.isPending}
                onClick={() => { void handleFinishCourse() }}
              >
                {finishCourseMutation.isPending ? "Clôture en cours..." : "Terminer le cours"}
              </Button>
            </section>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ── Modale "appel maintenant ou plus tard ?" ─────────────────── */}
      <AlertDialog open={showRollCallPrompt} onOpenChange={setShowRollCallPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Faire le pointage des élèves maintenant ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Votre présence est confirmée. Souhaitez-vous faire le pointage des élèves maintenant ou plus tard ?</p>
                <p className="font-medium text-amber-700">
                  Le pointage doit être effectué avant {formatTime(slot.end_time)}.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleRollCallLater}>Le faire plus tard</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollCallNow}>Faire l'appel maintenant</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
