import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ScheduleSlot, TeacherAttendance } from "@/modules/attendance/attendance.api"
import { AbsentIcon, LateIcon, PresentIcon, RoomIcon } from "@/shared/components/icons"

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

const getStatus = (slot: ScheduleSlot, attendance: TeacherAttendance | undefined, now: Date): CourseStatus => {
  const courseDateKey = slot.date ?? toDateKey(now)
  const start = toDateTime(courseDateKey, slot.start_time)
  const end = toDateTime(courseDateKey, slot.end_time)

  const hasCheckIn = attendance?.status === "present" || attendance?.status === "late" || attendance?.status === "excused"

  if (hasCheckIn && now >= end) {
    return "done"
  }

  if (now >= start && now <= end) {
    return "now"
  }

  if (now > end) {
    return "missed"
  }

  return "upcoming"
}

export default function CourseCard({ slot, attendance, onStartCourse }: CourseCardProps) {
  const now = new Date()
  const status = getStatus(slot, attendance, now)
  const alreadyCheckedIn =
    attendance?.status === "present" || attendance?.status === "late" || attendance?.status === "excused"

  const courseDateKey = slot.date ?? toDateKey(now)
  const start = toDateTime(courseDateKey, slot.start_time)
  const minutesToStart = Math.floor((start.getTime() - now.getTime()) / 60000)

  const canStart = !alreadyCheckedIn && (status === "now" || (status === "upcoming" && minutesToStart <= 30))

  return (
    <li
      data-testid={`teacher-course-card-${slot.id}`}
      className={cn(
        "min-h-[80px] rounded-xl border bg-card p-4 shadow-card",
        status === "now" && "border-primary",
        status === "missed" && "border-red-300",
        status === "done" && "bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
          </p>
          <p className="text-sm font-semibold">
            {slot.subject_name} - {slot.class_name}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <RoomIcon className="h-3.5 w-3.5" />
            {slot.room_name}
          </p>

          {status === "now" ? (
            <p className="flex items-center gap-2 text-xs font-medium text-green-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              En cours
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          {status === "done" ? (
            <Badge variant="outline" className="text-xs" data-testid={`teacher-course-status-${slot.id}`}>
              {attendance?.status === "late" ? <LateIcon className="mr-1 h-3.5 w-3.5" /> : <PresentIcon className="mr-1 h-3.5 w-3.5" />}
              {attendance?.status === "late" ? "En retard" : "Présent"}
            </Badge>
          ) : null}

          {alreadyCheckedIn && status !== "done" ? (
            <Badge variant="outline" className="text-xs" data-testid={`teacher-course-status-${slot.id}`}>
              Déjà enregistré
            </Badge>
          ) : null}

          {status === "missed" ? (
            <Badge variant="destructive" className="text-xs">
              <AbsentIcon className="mr-1 h-3.5 w-3.5" />
              Non pointé
            </Badge>
          ) : null}

          {canStart ? (
            <Button
              type="button"
              size="sm"
              data-testid={`teacher-start-course-${slot.id}`}
              onClick={() => onStartCourse(slot)}
            >
              Démarrer le cours
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export { getStatus }
