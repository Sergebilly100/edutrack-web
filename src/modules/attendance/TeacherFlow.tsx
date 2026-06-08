import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react"

import QRScanner from "@/modules/attendance/QRScanner"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import {
  bulkStudents,
  checkIn,
  fetchRooms,
  fetchStudents,
  qrScan,
  type BulkStudentsPayload,
  type BulkStudentsResponse,
  type CheckInPayload,
  type CheckInResponse,
  type QrScanPayload,
  type QrScanResponse,
  type RoomItem,
  type StudentItem,
} from "@/modules/attendance/attendance.api"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import {
  OfflineMutationQueuedError,
  useOfflineMutation,
} from "@/shared/hooks/useOfflineMutation"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { OFFLINE_QUEUE_KEYS } from "@/shared/store/offline-processors"
import { cacheRooms, getRoomByToken } from "@/shared/utils/indexedDB"

export type TeacherSchedule = {
  id: string
  class_id: string
  class_name: string
  subject_name: string
  room_id: string
  room_name: string
  start_at: string
  end_at: string
}

type TeacherFlowProps = {
  schedule: TeacherSchedule
  demoMode?: boolean
}

const formatTimeRange = (startAt: string, endAt: string) => {
  const start = new Date(startAt)
  const end = new Date(endAt)

  return `${start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
}

const DEMO_STUDENTS: StudentItem[] = [
  { id: "demo-student-1", full_name: "Kouadio Amani", matricule: null },
  { id: "demo-student-2", full_name: "Traoré Mariam", matricule: null },
  { id: "demo-student-3", full_name: "Koné Ibrahim", matricule: null },
]

const isOfflineQueued = (error: unknown): error is OfflineMutationQueuedError =>
  error instanceof OfflineMutationQueuedError

function Step4Success({
  absentCount,
  notifSendAfter,
  onUpdateCall,
}: {
  absentCount: number
  notifSendAfter: number
  onUpdateCall: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (notifSendAfter <= 0) return
    const interval = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(interval)
  }, [notifSendAfter])

  const isLocked = notifSendAfter > 0 && now >= notifSendAfter
  const deadlineLabel = notifSendAfter > 0
    ? new Date(notifSendAfter).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
      <p className="text-lg font-semibold text-green-800">Cours démarré. Bonne journée !</p>
      <p className="text-sm text-green-700">Résumé : {absentCount} absent(s) enregistré(s).</p>
      {deadlineLabel ? (
        <p className="text-xs text-green-600">
          {isLocked
            ? "Appel verrouillé - délai de modification expiré."
            : `Modifiable jusqu'à ${deadlineLabel}`}
        </p>
      ) : null}
      {!isLocked ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-green-300 text-green-800 hover:bg-green-100"
          onClick={onUpdateCall}
        >
          Mettre à jour l'appel
        </Button>
      ) : null}
    </div>
  )
}

const ABSENT_STORAGE_KEY = (scheduleId: string) => `tf-absent-${scheduleId}`

export default function TeacherFlow({ schedule, demoMode = false }: TeacherFlowProps) {
  const studentLabels = useStudentLabels()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [lateMinutes, setLateMinutes] = useState<number | null>(null)
  const [isQrSubmitting, setIsQrSubmitting] = useState(false)
  const [absentStudentIds, setAbsentStudentIds] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem(ABSENT_STORAGE_KEY(schedule.id))
      return saved ? new Set<string>(JSON.parse(saved) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const [qrWarning, setQrWarning] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [qrHelpOpen, setQrHelpOpen] = useState(false)
  const [notifSendAfter, setNotifSendAfter] = useState<number>(0)
  const [isUpdateMode, setIsUpdateMode] = useState(false)
  const { toast } = useToast()

  const { isOnline } = useNetworkStatus()

  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: fetchRooms,
    staleTime: 1000 * 60 * 10,
    enabled: !demoMode,
  })

  // CRITIQUE FIX : Cache rooms dans IndexedDB pour QR scan offline
  useEffect(() => {
    if (roomsQuery.data && roomsQuery.data.length > 0) {
      cacheRooms(
        roomsQuery.data.map((room) => ({
          id: room.id,
          name: room.name,
          qr_token: room.qr_token,
          cached_at: Date.now(),
        }))
      ).catch((error) => {
        console.error("[TeacherFlow] failed to cache rooms in IndexedDB", error)
      })
    }
  }, [roomsQuery.data])

  const studentsQuery = useQuery({
    queryKey: ["students", schedule.class_id],
    queryFn: () => fetchStudents(schedule.class_id),
    enabled: !demoMode && step >= 3,
  })

  useEffect(() => {
    setStep(1)
    setLateMinutes(null)
    setIsQrSubmitting(false)
    // Restore depuis sessionStorage pour le nouveau schedule
    try {
      const saved = sessionStorage.getItem(ABSENT_STORAGE_KEY(schedule.id))
      setAbsentStudentIds(saved ? new Set<string>(JSON.parse(saved) as string[]) : new Set())
    } catch {
      setAbsentStudentIds(new Set())
    }
    setQrWarning(null)
    setQrHelpOpen(false)
  }, [schedule.id])

  useEffect(() => {
    if (studentsQuery.data) {
      // Ne pas écraser si une sélection a été restaurée depuis sessionStorage
      const saved = sessionStorage.getItem(ABSENT_STORAGE_KEY(schedule.id))
      if (!saved) {
        setAbsentStudentIds(new Set())
      }
    }
  }, [studentsQuery.data, schedule.id])

  const checkInMutation = useOfflineMutation<CheckInResponse, CheckInPayload>(
    checkIn,
    { queueKey: OFFLINE_QUEUE_KEYS.attendanceCheckin }
  )

  const qrScanMutation = useOfflineMutation<QrScanResponse, QrScanPayload>(qrScan, {
    queueKey: OFFLINE_QUEUE_KEYS.attendanceQrScan,
  })

  const bulkStudentsMutation = useOfflineMutation<BulkStudentsResponse, BulkStudentsPayload>(
    bulkStudents,
    { queueKey: OFFLINE_QUEUE_KEYS.attendanceStudentsBulk }
  )

  const absentCount = absentStudentIds.size

  const handleRestart = () => {
    setStep(1)
    setLateMinutes(null)
    setIsQrSubmitting(false)
    setAbsentStudentIds(new Set())
    setQrWarning(null)
    setConfirmDialogOpen(false)
    setQrHelpOpen(false)
    setNotifSendAfter(0)
    setIsUpdateMode(false)
    try { sessionStorage.removeItem(ABSENT_STORAGE_KEY(schedule.id)) } catch { /* noop */ }
    toast({
      title: "Flow réinitialisé",
      description: "Vous pouvez recommencer le pointage.",
    })
  }

  const handleCheckIn = async () => {
    if (demoMode) {
      setStep(2)
      toast({
        title: "Présence enregistrée (démo)",
        description: "Mode démonstration: aucune donnée réelle n'a été modifiée.",
      })
      return
    }

    const result = await checkInMutation
      .mutateAsync({ schedule_id: schedule.id, client_timestamp: new Date().toISOString() })
      .catch((error: unknown) => {
        if (isOfflineQueued(error)) {
          return null
        }
        throw error
      })
    let resolvedLateMinutes = lateMinutes

    if (typeof result?.late_minutes === "number" && result.late_minutes > 0) {
      setLateMinutes(result.late_minutes)
      resolvedLateMinutes = result.late_minutes
    }

    setStep(2)
    toast({
      title: "Présence enregistrée",
      description:
        resolvedLateMinutes !== null && resolvedLateMinutes > 0
          ? `Retard de ${resolvedLateMinutes} min.`
          : undefined,
    })
  }

  const resolveScannedRoom = async (token: string): Promise<RoomItem | null> => {
    // CRITIQUE FIX : Fallback sur IndexedDB si hors ligne ou cache React Query vide
    let rooms = roomsQuery.data

    if (!rooms || rooms.length === 0) {
      // Tentative de refetch si en ligne
      if (isOnline) {
        try {
          const result = await roomsQuery.refetch()
          rooms = result.data
        } catch {
          rooms = []
        }
      }

      // Si toujours vide, fallback sur IndexedDB (offline)
      if (!rooms || rooms.length === 0) {
        try {
          const cachedRoom = await getRoomByToken(token)
          if (cachedRoom) {
            return {
              id: cachedRoom.id,
              name: cachedRoom.name,
              qr_token: cachedRoom.qr_token,
            }
          }
        } catch (error) {
          console.error("[TeacherFlow] failed to read from IndexedDB", error)
        }
      }
    }

    return (rooms ?? []).find((room) => room.qr_token === token) ?? null
  }

  const handleQrDetected = async (token: string) => {
    if (demoMode) {
      setQrWarning(null)
      setStep(3)
      toast({
        title: "Scan validé (démo)",
        description: "Mode démonstration: le QR est accepté automatiquement.",
      })
      return
    }

    if (isQrSubmitting) {
      return
    }

    setIsQrSubmitting(true)

    try {
      const matchedRoom = await resolveScannedRoom(token)
      if (!matchedRoom) {
        toast({
          title: "QR non reconnu",
          description: "Ce QR ne correspond à aucune salle de l'établissement.",
          variant: "destructive",
        })
        return
      }

      const response = await qrScanMutation
        .mutateAsync({
          qr_token: token,
          scan_type: "start",
          schedule_id: schedule.id,
          date: new Date().toISOString().split("T")[0],
          client_timestamp: new Date().toISOString(),
        })
        .catch((error: unknown) => {
          if (isOfflineQueued(error)) {
            return null
          }
          throw error
        })

      const isRoomMismatch = isOnline
        ? Boolean(response?.room_mismatch) || matchedRoom.id !== schedule.room_id
        : matchedRoom.id !== schedule.room_id

      if (isRoomMismatch) {
        setQrWarning(
          "Salle différente de la salle prévue. La direction sera notifiée automatiquement."
        )
        toast({
          title: "Salle différente",
          description:
            "Le pointage continue. Une alerte est envoyée à la direction.",
          variant: "destructive",
        })
      } else {
        setQrWarning(null)
      }

      setStep(3)
    } catch {
      toast({
        title: "Échec du scan QR",
        description: "Impossible de valider ce scan pour le moment.",
        variant: "destructive",
      })
    } finally {
      setIsQrSubmitting(false)
    }
  }

  const toggleAbsent = useCallback((studentId: string) => {
    setAbsentStudentIds((previous) => {
      const next = new Set(previous)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      try {
        sessionStorage.setItem(ABSENT_STORAGE_KEY(schedule.id), JSON.stringify([...next]))
      } catch { /* quota / private mode */ }
      return next
    })
  }, [schedule.id])

  const handleSubmitCall = async () => {
    if (demoMode) {
      setStep(4)
      setNotifSendAfter(Date.now() + 15 * 60 * 1000)
      toast({
        title: "Appel validé (démo)",
        description: `${absentStudentIds.size} absent(s) simulé(s).`,
      })
      return
    }

    const result = await bulkStudentsMutation
      .mutateAsync({
        schedule_id: schedule.id,
        date: new Date().toISOString().split("T")[0],
        absent_student_ids: [...absentStudentIds],
      })
      .catch((error: unknown) => {
        if (isOfflineQueued(error)) {
          return null
        }
        // 409 ROLLCALL_WINDOW_CLOSED - deadline dépassée
        const axiosError = error as { response?: { data?: { code?: string } } }
        if (axiosError?.response?.data?.code === "ROLLCALL_WINDOW_CLOSED") {
          toast({
            title: "Délai expiré",
            description: "La fenêtre de modification de l'appel est fermée.",
            variant: "destructive",
          })
          setIsUpdateMode(false)
          return null
        }
        throw error
      })

    try { sessionStorage.removeItem(ABSENT_STORAGE_KEY(schedule.id)) } catch { /* noop */ }
    if (result) {
      setNotifSendAfter(result.notifSendAfter)
    }
    setStep(4)
    setIsUpdateMode(false)
    toast({
      title: isUpdateMode ? "Appel mis à jour" : "Appel validé",
      description: `${absentStudentIds.size} absent(s) enregistré(s).`,
    })
  }

  const progressLabel = `${Math.min(step, 3)}/3`
  const studentRows = demoMode ? DEMO_STUDENTS : studentsQuery.data ?? []
  const timeRange = useMemo(
    () => formatTimeRange(schedule.start_at, schedule.end_at),
    [schedule.end_at, schedule.start_at]
  )

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Flux enseignant</h2>
        <div className="flex items-center gap-2">
          {demoMode ? <Badge variant="secondary">Mode démo</Badge> : null}
          <Badge variant="outline">Étape {progressLabel}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={step >= 1 ? "default" : "outline"}>1. Présence</Badge>
        <Badge variant={step >= 2 ? "default" : "outline"}>2. QR Salle</Badge>
        <Badge variant={step >= 3 ? "default" : "outline"}>3. Appel</Badge>
      </div>

      {step === 1 ? (
        <div className="space-y-4 pb-24 md:pb-0">
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium">Matière :</span> {schedule.subject_name}
            </p>
            <p>
              <span className="font-medium">Classe :</span> {schedule.class_name}
            </p>
            <p>
              <span className="font-medium">Salle prévue :</span> {schedule.room_name}
            </p>
            <p>
              <span className="font-medium">Créneau :</span> {timeRange}
            </p>
          </div>

          {lateMinutes !== null && lateMinutes > 0 ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
              Retard de {lateMinutes}min
            </Badge>
          ) : null}

          {/* Desktop : bouton inline. Mobile : bouton sticky en bas */}
          <Button
            size="lg"
            className="hidden min-h-[72px] w-full active:scale-95 transition-transform md:flex"
            disabled={checkInMutation.isPending}
            onClick={() => void handleCheckIn()}
          >
            {checkInMutation.isPending ? "Validation..." : "Je suis présent(e)"}
          </Button>
          <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-4 md:hidden">
            <Button
              size="lg"
              className="min-h-[64px] w-full active:scale-95 transition-transform"
              disabled={checkInMutation.isPending}
              onClick={() => void handleCheckIn()}
            >
              {checkInMutation.isPending ? "Validation..." : "Je suis présent(e)"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Scannez le QR code de la salle {schedule.room_name}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRestart}
            >
              ← Recommencer
            </Button>
          </div>

          {/* Aide contextuelle QR - Jordan persona */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setQrHelpOpen((o) => !o)}
              aria-expanded={qrHelpOpen}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Où trouver le QR code ?
            </button>
            {qrHelpOpen ? (
              <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <p className="font-medium">Le QR code de la salle est affiché :</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  <li>Collé sur la porte ou le tableau de la salle</li>
                  <li>Ou affiché sur l'écran du responsable à l'entrée</li>
                </ul>
                <p className="mt-2 text-xs text-blue-700">
                  Si vous ne trouvez pas le QR, utilisez la saisie manuelle ci-dessous.
                </p>
              </div>
            ) : null}
          </div>

          {demoMode ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(3)}
            >
              Passer le scan (démo)
            </Button>
          ) : null}
          {lateMinutes !== null && lateMinutes > 0 ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
              Retard de {lateMinutes}min
            </Badge>
          ) : null}
          <QRScanner
            scheduleId={schedule.id}
            scanType="start"
            onTokenDetected={(token) => {
              void handleQrDetected(token)
            }}
          />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Appel de {schedule.class_name}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={isUpdateMode ? () => { setIsUpdateMode(false); setStep(4) } : handleRestart}
            >
              {isUpdateMode ? "← Annuler" : "← Recommencer"}
            </Button>
          </div>

          {isUpdateMode ? (
            <Alert>
              <AlertDescription className="text-sm text-amber-900">
                Vous modifiez un appel déjà soumis. Les notifications seront différées jusqu'à la fin du délai.
              </AlertDescription>
            </Alert>
          ) : null}

          {qrWarning ? (
            <Alert variant="destructive">
              <AlertDescription>{qrWarning}</AlertDescription>
            </Alert>
          ) : null}

          {studentsQuery.isLoading && !demoMode ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : null}

          {!studentsQuery.isLoading && studentRows.length === 0 ? (
            <Alert>
              <AlertDescription>{`Aucun ${studentLabels.singularLower} trouvé pour cette classe.`}</AlertDescription>
            </Alert>
          ) : null}

          {studentsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {`Impossible de charger la liste des ${studentLabels.pluralLower} pour le moment.`}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            {studentRows.map((student) => {
              const isAbsent = absentStudentIds.has(student.id)

              return (
                <div
                  key={student.id}
                  className={`flex items-center justify-between rounded-md border p-2 transition-colors ${
                    isAbsent ? "border-red-200 bg-red-50/50" : "border-border"
                  }`}
                >
                  <span className="text-sm font-medium">{student.full_name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={isAbsent ? "destructive" : "secondary"}
                    className="min-h-[44px] gap-1.5 active:scale-95 transition-transform"
                    aria-label={isAbsent ? `Marquer ${student.full_name} présent` : `Marquer ${student.full_name} absent`}
                    onClick={() => toggleAbsent(student.id)}
                  >
                    {isAbsent ? (
                      <><XCircle className="h-4 w-4" aria-hidden="true" /> Absent</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Présent</>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>

          <Button
            className="w-full"
            disabled={bulkStudentsMutation.isPending || (!demoMode && studentsQuery.isLoading)}
            onClick={() => setConfirmDialogOpen(true)}
          >
            {bulkStudentsMutation.isPending
              ? "Validation..."
              : `Valider l'appel (${absentCount} absents)`}
          </Button>
        </div>
      ) : null}

      {step === 4 ? (
        <Step4Success
          absentCount={absentCount}
          notifSendAfter={notifSendAfter}
          onUpdateCall={() => {
            setIsUpdateMode(true)
            setStep(3)
          }}
        />
      ) : null}

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'appel</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Vous avez marqué <span className="font-semibold">{absentCount} {studentLabels.singularLower}(s)</span> absent(s) pour ce cours.
              </p>
              {absentCount > 0 ? (
                <p className="text-sm text-amber-900">
                  {isUpdateMode
                    ? "Les notifications aux parents seront mises à jour selon ce nouvel appel."
                    : "Cette action enverra des SMS de notification aux parents et ne pourra pas être annulée."}
                </p>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vérifier à nouveau</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDialogOpen(false)
                void handleSubmitCall()
              }}
            >
              {isUpdateMode ? "Mettre à jour l'appel" : "Confirmer l'appel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
