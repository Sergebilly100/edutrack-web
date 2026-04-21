import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ScheduleSlot, TeacherAttendance } from "@/modules/attendance/attendance.api"
import { AbsentIcon, LateIcon, PresentIcon, RoomIcon } from "@/shared/components/icons"
import { useRollCallStore } from "@/shared/store/rollCall.store"

interface CourseCardProps {
  slot: ScheduleSlot
  attendance?: TeacherAttendance
  onStartCourse: (slot: ScheduleSlot) => void
}

type CourseStatus = "upcoming" | "now" | "done" | "missed"

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const toDateTime = (dateKey: string, time: string) => {
  const [hours, minutes] = time.split(":")
  const date = new Date(dateKey)
  date.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0)
  return date
}

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":")
  return `${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}`
}

const getStatus = (
  slot: ScheduleSlot,
  attendance: TeacherAttendance | undefined,
  now: Date
): CourseStatus => {
  const courseDateKey = slot.date ?? toDateKey(now)
  const start = toDateTime(courseDateKey, slot.start_time)
  const end = toDateTime(courseDateKey, slot.end_time)

  const hasCheckIn =
    attendance?.status === "present" ||
    attendance?.status === "late" ||
    attendance?.status === "excused"

  if (hasCheckIn && now >= end) return "done"
  if (now >= start && now <= end) return "now"
  if (now > end) return "missed"
  return "upcoming"
}

export default function CourseCard({ slot, attendance, onStartCourse }: CourseCardProps) {
  const now = new Date()
  const status = getStatus(slot, attendance, now)

  const courseDateKey = slot.date ?? toDateKey(now)
  const end = toDateTime(courseDateKey, slot.end_time)
  const rollCallStillOpen = now <= end

  const alreadyCheckedIn =
    attendance?.status === "present" ||
    attendance?.status === "late" ||
    attendance?.status === "excused"

  const flowState = useRollCallStore((s) => s.getFlowState(slot.id, courseDateKey))
  const rollCallPending = flowState === "rollcall_pending"
  const checkinQrDone = flowState === "checkin_qr_done"

  // ── Règles d'affichage des boutons ────────────────────────────────────────

  /**
   * Point 1 — "Démarrer le cours" uniquement quand le cours EST EN COURS.
   * Suppression de la fenêtre de 30 min avant : pas de bouton en "upcoming".
   * Conditions : cours actif (status === "now") + pas encore pointé
   *              + aucun flow en cours (pas de "Poursuivre")
   */
  const canStart =
    status === "now" && !alreadyCheckedIn && !checkinQrDone && !rollCallPending

  /**
   * Point 5 — "Poursuivre le pointage" : étapes 1+2 faites, sheet fermé sans finir.
   * Le prof a pointé + scanné la salle mais a fermé le sheet avant l'appel.
   * Le flow n'est ni explicitement "plus tard" (rollcall_pending), ni terminé.
   */
  const canResume = checkinQrDone && rollCallStillOpen

  /**
   * Point 2 — "Faire le pointage des élèves" : appel différé explicitement.
   * Le prof a choisi "Non, plus tard" dans la modale.
   */
  const canDoRollCall = rollCallPending && rollCallStillOpen

  return (
    <li
      data-testid={`teacher-course-card-${slot.id}`}
      className={cn(
        "min-h-[80px] rounded-xl border bg-card p-4 shadow-sm",
        status === "now" && !rollCallPending && !checkinQrDone && "border-primary",
        status === "missed" && "border-red-300",
        status === "done" && "bg-muted/30",
        rollCallPending && rollCallStillOpen && "border-amber-300 bg-amber-50/40",
        checkinQrDone && rollCallStillOpen && "border-blue-200 bg-blue-50/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Infos du cours */}
        <div className="space-y-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
          </p>
          <p className="text-sm font-semibold">
            {slot.subject_name} - {slot.class_name}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <RoomIcon className="h-3.5 w-3.5 shrink-0" />
            {slot.room_name}
          </p>

          {/* En cours normal */}
          {status === "now" && !rollCallPending && !checkinQrDone ? (
            <p className="flex items-center gap-2 text-xs font-medium text-green-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              En cours
            </p>
          ) : null}

          {/* Rappel appel en attente */}
          {rollCallPending && rollCallStillOpen ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Appel élèves à faire avant {formatTime(slot.end_time)}
            </p>
          ) : null}

          {/* Rappel pointage non terminé */}
          {checkinQrDone && rollCallStillOpen ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Pointage à compléter
            </p>
          ) : null}
        </div>

        {/* Actions et badges */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Cours terminé avec pointage */}
          {status === "done" ? (
            <Badge
              variant="outline"
              className="text-xs"
              data-testid={`teacher-course-status-${slot.id}`}
            >
              {attendance?.status === "late" ? (
                <LateIcon className="mr-1 h-3.5 w-3.5" />
              ) : (
                <PresentIcon className="mr-1 h-3.5 w-3.5" />
              )}
              {attendance?.status === "late" ? "En retard" : "Présent"}
            </Badge>
          ) : null}

          {/* Pointé + appel fait */}
          {alreadyCheckedIn && !rollCallPending && !checkinQrDone && status !== "done" ? (
            <Badge
              variant="outline"
              className="text-xs border-green-200 bg-green-50 text-green-700"
              data-testid={`teacher-course-status-${slot.id}`}
            >
              <PresentIcon className="mr-1 h-3.5 w-3.5" />
              Présence confirmée
            </Badge>
          ) : null}

          {/* Non pointé à la fin */}
          {status === "missed" && !alreadyCheckedIn && !checkinQrDone ? (
            <Badge variant="destructive" className="text-xs">
              <AbsentIcon className="mr-1 h-3.5 w-3.5" />
              Non pointé
            </Badge>
          ) : null}

          {/* Cours terminé, appel non effectué */}
          {status === "missed" && rollCallPending ? (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-700 text-xs"
            >
              Appel non effectué
            </Badge>
          ) : null}

          {/* Cours terminé, pointage incomplet */}
          {(status === "missed" || !rollCallStillOpen) && checkinQrDone ? (
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700 text-xs"
            >
              Pointage incomplet
            </Badge>
          ) : null}

          {/* ── Bouton 1 : Démarrer le cours (point 1 : uniquement si cours en cours) */}
          {canStart ? (
            <Button
              type="button"
              size="sm"
              className="active:scale-95 transition-transform"
              data-testid={`teacher-start-course-${slot.id}`}
              onClick={() => onStartCourse(slot)}
            >
              Démarrer le cours
            </Button>
          ) : null}

          {/* ── Bouton 2 : Poursuivre le pointage (point 5 : sheet fermé accidentellement) */}
          {canResume ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 transition-transform"
              data-testid={`teacher-resume-course-${slot.id}`}
              onClick={() => onStartCourse(slot)}
            >
              Poursuivre le pointage
            </Button>
          ) : null}

          {/* ── Bouton 3 : Faire le pointage des élèves (point 2 : appel différé) */}
          {canDoRollCall ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 active:scale-95 transition-transform"
              data-testid={`teacher-rollcall-${slot.id}`}
              onClick={() => onStartCourse(slot)}
            >
              Faire le pointage des élèves
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export { getStatus }
