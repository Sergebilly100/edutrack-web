import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { ScheduleRow } from "@/modules/schedule/schedule.api"

import SlotCard from "./SlotCard"
import { computeSlotLayouts } from "./WeekGrid"

type DayColumnProps = {
  day: { value: number; label: string; date: Date }
  isToday: boolean
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
  isToday,
  slots,
  gridStartHour,
  gridEndHour,
  hourHeight,
  onSlotClick,
  onSlotAdd,
  isBlockedTeacher,
  getSubjectColorClass,
}: DayColumnProps) {
  const hours = Array.from(
    { length: gridEndHour - gridStartHour },
    (_, index) => gridStartHour + index
  )
  const gridHeight = (gridEndHour - gridStartHour) * hourHeight
  const gridStartMinutes = gridStartHour * 60

  /**
   * FIX BUG 2 — Calcul de la disposition des slots en collision.
   * Pour chaque slot chevauchant un autre sur le même créneau horaire,
   * on attribue une sous-colonne (columnIndex / columnCount) afin de
   * les afficher côte à côte plutôt que superposés.
   */
  const layouts = useMemo(() => computeSlotLayouts(slots), [slots])

  return (
    <div className="min-w-[170px] flex-1">
      <div
        className={cn(
          "sticky top-0 z-20 border-b bg-background/95 px-2 py-2 text-center backdrop-blur",
          isToday ? "border-primary bg-primary/5" : ""
        )}
      >
        <p className="text-xs font-semibold">{day.label}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatDate(day.date)}
          {isToday ? " • Aujourd'hui" : ""}
        </p>
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

          const layout = layouts.get(slot.id)
          const columnCount = layout?.columnCount ?? 1
          const columnIndex = layout?.columnIndex ?? 0

          /**
           * FIX BUG 2 — Positionnement en sous-colonnes.
           *
           * Chaque slot occupe une fraction de la largeur de la cellule.
           * On utilise des pourcentages pour rester fluide quelle que soit
           * la largeur de la colonne jour.
           *
           * Exemple : 3 cours simultanés → chacun occupe ~33% de la largeur,
           * avec 2px de marge entre les cartes.
           */
          const GUTTER = 2 // px entre les sous-colonnes
          const totalGutter = GUTTER * (columnCount - 1)
          // left et width en px (on laisse le positionnement absolu gérer)
          // On passe ces valeurs en style inline car ce sont des calculs dynamiques
          // (exception à la règle "pas de styles inline" : valeurs calculées, pas de couleurs)
          const widthPct = (1 / columnCount) * 100
          const leftPct = (columnIndex / columnCount) * 100

          return (
            <SlotCard
              key={slot.id}
              slot={slot}
              height={height}
              columnCount={columnCount}
              onClick={() => onSlotClick(slot)}
              isBlockedTeacher={isBlockedTeacher(slot.teacher.id)}
              className={cn("z-10", getSubjectColorClass(slot.subject))}
              style={{
                top,
                height,
                left: `calc(${leftPct}% + ${columnIndex > 0 ? GUTTER : 1}px)`,
                right: `calc(${100 - leftPct - widthPct}% + ${columnIndex < columnCount - 1 ? GUTTER : 1}px)`,
                width: undefined, // géré via left+right
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
