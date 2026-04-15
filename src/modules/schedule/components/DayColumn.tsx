import { cn } from "@/lib/utils"
import type { ScheduleRow } from "@/modules/schedule/schedule.api"

import SlotCard from "./SlotCard"

type DayColumnProps = {
  day: { value: number; label: string; date: Date }
  slots: ScheduleRow[]
  gridStartHour: number
  gridEndHour: number
  hourHeight: number
  onSlotClick: (slot: ScheduleRow) => void
  onSlotAdd: (day: number, hour: number) => void
  isBlockedTeacher: (teacherId: string) => boolean
  getSubjectColorClass: (subject: string) => string
}

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":")
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0)
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(date)

export default function DayColumn({
  day,
  slots,
  gridStartHour,
  gridEndHour,
  hourHeight,
  onSlotClick,
  onSlotAdd,
  isBlockedTeacher,
  getSubjectColorClass,
}: DayColumnProps) {
  const hours = Array.from({ length: gridEndHour - gridStartHour }, (_, index) => gridStartHour + index)
  const gridHeight = (gridEndHour - gridStartHour) * hourHeight
  const gridStartMinutes = gridStartHour * 60

  return (
    <div className="min-w-[170px] flex-1">
      <div className="sticky top-0 z-20 border-b bg-background/95 px-2 py-2 text-center backdrop-blur">
        <p className="text-xs font-semibold">{day.label}</p>
        <p className="text-[11px] text-muted-foreground">{formatDate(day.date)}</p>
      </div>

      <div className="relative border-l" style={{ height: gridHeight }}>
        {hours.map((hour) => (
          <button
            key={hour}
            type="button"
            className="block h-16 w-full border-b hover:bg-muted/40"
            onClick={() => onSlotAdd(day.value, hour)}
            aria-label={`Ajouter un créneau le ${day.label} à ${String(hour).padStart(2, "0")}h`}
          />
        ))}

        {slots.map((slot) => {
          const startMinutes = toMinutes(slot.timeSlot.startTime)
          const endMinutes = toMinutes(slot.timeSlot.endTime)
          const durationMinutes = Math.max(15, endMinutes - startMinutes)
          const top = ((startMinutes - gridStartMinutes) / 60) * hourHeight
          const height = (durationMinutes / 60) * hourHeight

          return (
            <SlotCard
              key={slot.id}
              slot={slot}
              height={height}
              onClick={() => onSlotClick(slot)}
              isBlockedTeacher={isBlockedTeacher(slot.teacher.id)}
              className={cn("z-10", getSubjectColorClass(slot.subject))}
              style={{
                top,
                height,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
