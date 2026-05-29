import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import QRScanner from "@/modules/attendance/QRScanner"
import { Alert, AlertDescription } from "@/components/ui/alert"
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

export default function TeacherFlow({ schedule, demoMode = false }: TeacherFlowProps) {
  const studentLabels = useStudentLabels()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [lateMinutes, setLateMinutes] = useState<number | null>(null)
  const [isQrSubmitting, setIsQrSubmitting] = useState(false)
  const [absentStudentIds, setAbsentStudentIds] = useState<Set<string>>(new Set())
  const [qrWarning, setQrWarning] = useState<string | null>(null)
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
    setAbsentStudentIds(new Set())
    setQrWarning(null)
  }, [schedule.id])

  useEffect(() => {
    if (studentsQuery.data) {
      setAbsentStudentIds(new Set())
    }
  }, [studentsQuery.data])

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

  const toggleAbsent = (studentId: string) => {
    setAbsentStudentIds((previous) => {
      const next = new Set(previous)

      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }

      return next
    })
  }

  const handleSubmitCall = async () => {
    if (demoMode) {
      setStep(4)
      toast({
        title: "Appel validé (démo)",
        description: `${absentStudentIds.size} absent(s) simulé(s).`,
      })
      return
    }

    await bulkStudentsMutation
      .mutateAsync({
        schedule_id: schedule.id,
        date: new Date().toISOString().split("T")[0],
        absent_student_ids: [...absentStudentIds],
      })
      .catch((error: unknown) => {
        if (isOfflineQueued(error)) {
          return null
        }
        throw error
      })

    setStep(4)
    toast({
      title: "Appel validé",
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
        <div className="space-y-4">
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
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
              Retard de {lateMinutes}min
            </Badge>
          ) : null}

          <Button
            size="lg"
            className="min-h-[72px] w-full active:scale-95 transition-transform"
            disabled={checkInMutation.isPending}
            onClick={() => void handleCheckIn()}
          >
            {checkInMutation.isPending ? "Validation..." : "Je suis présent(e)"}
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <p className="text-sm font-medium">Scannez le QR code de la salle {schedule.room_name}</p>
          {demoMode ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep(3)
              }}
            >
              Passer le scan (démo)
            </Button>
          ) : null}
          {lateMinutes !== null && lateMinutes > 0 ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
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
          <h3 className="text-base font-semibold">Appel de {schedule.class_name}</h3>

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
                  className="flex items-center justify-between rounded-md border border-border p-2"
                >
                  <span className="text-sm font-medium">{student.full_name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={isAbsent ? "destructive" : "secondary"}
                    className="min-h-[44px] active:scale-95 transition-transform"
                    onClick={() => toggleAbsent(student.id)}
                  >
                    {isAbsent ? "Absent" : "Présent"}
                  </Button>
                </div>
              )
            })}
          </div>

          <Button
            className="w-full"
            disabled={bulkStudentsMutation.isPending || (!demoMode && studentsQuery.isLoading)}
            onClick={() => void handleSubmitCall()}
          >
            {bulkStudentsMutation.isPending
              ? "Validation..."
              : `Valider l'appel (${absentCount} absents)`}
          </Button>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-lg font-semibold text-green-800">Cours démarré. Bonne journée !</p>
          <p className="text-sm text-green-700">Résumé : {absentCount} absents enregistrés.</p>
        </div>
      ) : null}
    </div>
  )
}
