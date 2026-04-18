import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ScheduleRow } from "@/modules/schedule/schedule.api"
import { ChevronLeftIcon, ChevronRightIcon } from "@/shared/components/icons"

import DayColumn from "./DayColumn"

export interface WeekGridProps {
  slots: ScheduleRow[]
  weekStart: Date
  hasPeriod: boolean
  isLoading?: boolean
  onSlotClick: (slot: ScheduleRow) => void
  onSlotAdd: (day: number, hour: number) => void
  onWeekChange?: (nextWeekStart: Date) => void
  onToday?: () => void
  isBlockedTeacher?: (teacherId: string) => boolean
}

export const HOUR_HEIGHT = 64
const GRID_START_HOUR = 7
const GRID_END_HOUR = 18

const SUBJECT_COLORS = [
  "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-300",
  "bg-green-100 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-300",
  "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-950 dark:border-purple-700 dark:text-purple-300",
  "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-300",
  "bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-950 dark:border-rose-700 dark:text-rose-300",
  "bg-teal-100 border-teal-300 text-teal-800 dark:bg-teal-950 dark:border-teal-700 dark:text-teal-300",
  "bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-950 dark:border-orange-700 dark:text-orange-300",
  "bg-indigo-100 border-indigo-300 text-indigo-800 dark:bg-indigo-950 dark:border-indigo-700 dark:text-indigo-300",
  "bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-950 dark:border-pink-700 dark:text-pink-300",
  "bg-cyan-100 border-cyan-300 text-cyan-800 dark:bg-cyan-950 dark:border-cyan-700 dark:text-cyan-300",
] as const

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
] as const

const formatWeekRange = (weekStart: Date) => {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 4)

  const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit" })
  const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short" })

  return `Semaine du ${dayFormatter.format(weekStart)} au ${dayFormatter.format(weekEnd)} ${monthFormatter.format(weekEnd)}.`
}

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

const hashCode = (value: string) => {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }

  return Math.abs(hash)
}

const getSubjectColorClass = (subject: string) => {
  const index = hashCode(subject) % SUBJECT_COLORS.length
  return SUBJECT_COLORS[index]
}

/**
 * Calcule la disposition des slots qui se chevauchent dans une colonne jour.
 *
 * Pour chaque slot, on détermine :
 * - `columnIndex` : indice de la sous-colonne (0, 1, 2…)
 * - `columnCount`  : nombre total de sous-colonnes dans le groupe de collision
 *
 * Algorithme O(n²) acceptable (< 20 slots / jour en pratique).
 */
export type SlotLayout = {
  slotId: string
  columnIndex: number
  columnCount: number
}

const toMinutesFromTime = (time: string): number => {
  const [h, m] = time.split(":")
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}

export const computeSlotLayouts = (slots: ScheduleRow[]): Map<string, SlotLayout> => {
  const result = new Map<string, SlotLayout>()

  if (slots.length === 0) return result

  // Trier par heure de début
  const sorted = [...slots].sort(
    (a, b) =>
      toMinutesFromTime(a.timeSlot.startTime) - toMinutesFromTime(b.timeSlot.startTime)
  )

  // Groupes de slots qui se chevauchent temporellement
  const groups: ScheduleRow[][] = []
  let currentGroup: ScheduleRow[] = []
  let groupEnd = -1

  for (const slot of sorted) {
    const start = toMinutesFromTime(slot.timeSlot.startTime)
    const end = toMinutesFromTime(slot.timeSlot.endTime)

    if (start < groupEnd) {
      // Collision avec le groupe courant
      currentGroup.push(slot)
      groupEnd = Math.max(groupEnd, end)
    } else {
      // Nouveau groupe
      if (currentGroup.length > 0) groups.push(currentGroup)
      currentGroup = [slot]
      groupEnd = end
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup)

  // Pour chaque groupe, assigner des sous-colonnes par greedy coloring
  for (const group of groups) {
    const columnCount = group.length
    // Attribution greedy : on place chaque slot dans la première colonne libre
    const columnEnds: number[] = []

    for (const slot of group) {
      const start = toMinutesFromTime(slot.timeSlot.startTime)
      const end = toMinutesFromTime(slot.timeSlot.endTime)

      let placed = false
      for (let col = 0; col < columnEnds.length; col++) {
        if ((columnEnds[col] ?? 0) <= start) {
          result.set(slot.id, { slotId: slot.id, columnIndex: col, columnCount })
          columnEnds[col] = end
          placed = true
          break
        }
      }

      if (!placed) {
        const col = columnEnds.length
        result.set(slot.id, { slotId: slot.id, columnIndex: col, columnCount })
        columnEnds.push(end)
      }
    }

    // Remettre à jour columnCount avec le nombre réel de colonnes utilisées
    const realColumnCount = columnEnds.length
    for (const slot of group) {
      const layout = result.get(slot.id)
      if (layout) {
        result.set(slot.id, { ...layout, columnCount: realColumnCount })
      }
    }
  }

  return result
}

export default function WeekGrid({
  slots,
  weekStart,
  hasPeriod,
  isLoading = false,
  onSlotClick,
  onSlotAdd,
  onWeekChange,
  onToday,
  isBlockedTeacher,
}: WeekGridProps) {
  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
    (_, index) => GRID_START_HOUR + index
  )
  const days = DAYS.map((day, index) => ({
    ...day,
    date: addDays(weekStart, index),
  }))

  const slotsByDay = new Map<number, ScheduleRow[]>()
  for (const slot of slots) {
    const list = slotsByDay.get(slot.dayOfWeek) ?? []
    list.push(slot)
    slotsByDay.set(slot.dayOfWeek, list)
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onWeekChange?.(addDays(weekStart, -7))}
            aria-label="Semaine précédente"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium">{formatWeekRange(weekStart)}</p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onWeekChange?.(addDays(weekStart, 7))}
            aria-label="Semaine suivante"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>

        <Button type="button" variant="secondary" size="sm" onClick={onToday}>
          Aujourd'hui
        </Button>
      </div>

      {/* État de chargement — skeleton overlay léger */}
      {isLoading ? (
        <div className="flex h-24 items-center justify-center rounded-md border bg-muted/30">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      ) : !hasPeriod ? (
        /* FIX BUG 1 : Pas de période active → grille vide explicite */
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed bg-muted/20">
          <p className="text-sm text-muted-foreground">
            Aucune période d'emploi du temps pour cette semaine.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[1100px]">
            <div className="w-12 flex-shrink-0 border-r">
              <div
                className="sticky top-0 z-20 h-[53px] border-b bg-background/95 backdrop-blur"
                aria-hidden="true"
              />
              <div aria-hidden="true">
                {hours.map((hour, index) => (
                  <div
                    key={hour}
                    className={cn(
                      "flex h-16 items-start justify-end pr-1 text-[11px] text-muted-foreground",
                      index < hours.length - 1 ? "border-b" : ""
                    )}
                  >
                    {String(hour).padStart(2, "0")}h
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-w-0 flex-1">
              {days.map((day) => (
                <DayColumn
                  key={day.value}
                  day={day}
                  slots={(slotsByDay.get(day.value) ?? []).sort(
                    (a, b) => a.timeSlot.sortOrder - b.timeSlot.sortOrder
                  )}
                  gridStartHour={GRID_START_HOUR}
                  gridEndHour={GRID_END_HOUR}
                  hourHeight={HOUR_HEIGHT}
                  onSlotClick={onSlotClick}
                  onSlotAdd={onSlotAdd}
                  isBlockedTeacher={(teacherId) =>
                    isBlockedTeacher ? isBlockedTeacher(teacherId) : false
                  }
                  getSubjectColorClass={getSubjectColorClass}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
