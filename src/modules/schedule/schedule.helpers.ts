import { isAxiosError } from "axios"

import type {
  ScheduleCreatePayload,
  ScheduleRecurrence,
  ScheduleRow,
  WeeklyScheduleData,
} from "./schedule.api"

export const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
] as const

export const generateTimeOptions = (): { label: string; value: string }[] => {
  const options: { label: string; value: string }[] = []
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) continue
      const hStr = String(h).padStart(2, "0")
      const mStr = String(m).padStart(2, "0")
      options.push({ label: `${hStr}:${mStr}`, value: `${hStr}:${mStr}` })
    }
  }
  return options
}

export const TIME_OPTIONS = generateTimeOptions()

export type ViewMode = "grid" | "list"

export type SlotFormState = {
  teacherId: string
  classId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  roomId: string
  subject: string
  schedulePeriodId: string
  // null = choix non encore fait (radio obligatoire)
  recurrence: ScheduleRecurrence | null
}

export type SlotCreatePrefill = {
  dayOfWeek?: number
  hour?: number
}

export const emptyFormState: SlotFormState = {
  teacherId: "",
  classId: "",
  dayOfWeek: "",
  startTime: "08:00",
  endTime: "09:00",
  roomId: "",
  subject: "",
  schedulePeriodId: "",
  recurrence: null,
}

export const toISODate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export const fromISODate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

export const isoDayOfWeek = (date: Date) => {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

export const timeToMinutes = (t: string): number => {
  const parts = t.split(":")
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0)
}

export const getMonday = (baseDate: Date) => {
  const copy = new Date(baseDate)
  copy.setHours(0, 0, 0, 0)
  const weekday = copy.getDay()
  const shift = weekday === 0 ? -6 : 1 - weekday
  copy.setDate(copy.getDate() + shift)
  return copy
}

export const getMondayForWeek = (weekOffset: 0 | 1): string => {
  const today = new Date()
  const monday = getMonday(today)
  monday.setDate(monday.getDate() + weekOffset * 7)
  return toISODate(monday)
}

export const shiftWeekIso = (weekIso: string, deltaWeeks: number): string => {
  const next = fromISODate(weekIso)
  next.setDate(next.getDate() + deltaWeeks * 7)
  return toISODate(next)
}

export const isPastScheduleSelection = (
  selectedWeekMonday: string,
  dayOfWeek: number,
  startTime: string,
  now: Date
) => {
  const selectedMonday = fromISODate(selectedWeekMonday)
  const currentMonday = getMonday(now)

  if (selectedMonday < currentMonday) return true
  if (selectedMonday > currentMonday) return false

  const nowIsoDay = isoDayOfWeek(now)
  if (dayOfWeek < nowIsoDay) return true
  if (dayOfWeek > nowIsoDay) return false

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = timeToMinutes(startTime)
  return startMinutes <= nowMinutes
}

export const occurrenceDateFromWeek = (
  selectedWeekMonday: string,
  dayOfWeek: number
): string => {
  const monday = fromISODate(selectedWeekMonday)
  monday.setDate(monday.getDate() + (dayOfWeek - 1))
  return toISODate(monday)
}

/**
 * Inverse de occurrenceDateFromWeek : à partir d'une DATE choisie (cours unique),
 * dérive le jour de semaine ISO (1=lundi..7=dimanche) et le lundi de sa semaine.
 * Permet de piloter la création d'un cours unique par un sélecteur de date plutôt
 * que par (semaine affichée + jour de semaine).
 */
export const weekMondayAndDayFromDate = (
  dateIso: string
): { weekMonday: string; dayOfWeek: number } => {
  const date = fromISODate(dateIso)
  return {
    weekMonday: toISODate(getMonday(date)),
    dayOfWeek: isoDayOfWeek(date),
  }
}

export const formatWeekRange = (weekStartIso: string) => {
  const weekStart = fromISODate(weekStartIso)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 5)

  const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit" })
  const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short" })
  return `Semaine du ${dayFormatter.format(weekStart)} au ${dayFormatter.format(weekEnd)} ${monthFormatter.format(weekEnd)}.`
}

export const sortSchedules = (items: ScheduleRow[]) =>
  [...items].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    const diff = timeToMinutes(a.timeSlot.startTime) - timeToMinutes(b.timeSlot.startTime)
    if (diff !== 0) return diff
    return a.teacher.name.localeCompare(b.teacher.name)
  })

export const toPayload = (formState: SlotFormState): ScheduleCreatePayload => ({
  schedulePeriodId: formState.schedulePeriodId,
  teacherId: formState.teacherId,
  classId: formState.classId,
  dayOfWeek: Number(formState.dayOfWeek),
  timeSlotId: "",
  startTime: formState.startTime,
  endTime: formState.endTime,
  roomId: formState.roomId,
  subject: formState.subject.trim(),
  ...(formState.recurrence ? { recurrence: formState.recurrence } : {}),
})

export const defaultFormStateFromData = (data: WeeklyScheduleData): SlotFormState => ({
  teacherId: "",
  classId: data.catalog.classes[0]?.id ?? "",
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "09:00",
  roomId: data.catalog.rooms[0]?.id ?? "",
  subject: "",
  schedulePeriodId: data.period?.id ?? "",
  recurrence: null,
})

export const createOptimisticSchedule = (
  id: string,
  payload: ScheduleCreatePayload,
  data: WeeklyScheduleData
): ScheduleRow | null => {
  const teacher = data.catalog.teachers.find((item) => item.id === payload.teacherId)
  const klass = data.catalog.classes.find((item) => item.id === payload.classId)
  const room = data.catalog.rooms.find((item) => item.id === payload.roomId)
  if (!teacher || !klass || !room) return null

  const start = payload.startTime ?? "00:00"
  const end = payload.endTime ?? "00:00"

  const existingSlot = data.catalog.timeSlots.find(
    (ts) => ts.startTime === start && ts.endTime === end
  )
  const timeSlot = existingSlot ?? {
    id: `optimistic-ts-${Date.now()}`,
    label: `${start} – ${end}`,
    startTime: start,
    endTime: end,
    sortOrder: timeToMinutes(start),
  }

  return {
    id,
    schedulePeriodId: payload.schedulePeriodId,
    dayOfWeek: payload.dayOfWeek,
    subject: payload.subject,
    startDate: payload.effectiveFrom ?? null,
    endDate: null,
    pastAttendanceCount: 0,
    hasPastAttendance: false,
    teacher,
    class: klass,
    room,
    timeSlot,
  }
}

export const getScheduleConflictMessage = (error: unknown): string => {
  if (!isAxiosError(error)) {
    return "Impossible d'enregistrer ce créneau."
  }

  const status = error.response?.status
  const code = error.response?.data?.code

  if (status === 409 && code === "TEACHER_SCHEDULE_CONFLICT") {
    return "Conflit: ce professeur a déjà un cours sur ce créneau."
  }
  if (status === 409 && code === "ROOM_SCHEDULE_CONFLICT") {
    return "Conflit: cette salle est déjà occupée sur ce créneau."
  }
  if (status === 409 && code === "CLASS_SCHEDULE_CONFLICT") {
    return "Conflit: cette classe a déjà un cours sur ce créneau."
  }
  if (status === 409 && code === "SCHEDULE_PAST_LOCKED") {
    return "Action impossible: les occurrences passées ne peuvent pas être modifiées."
  }

  if (typeof error.response?.data?.error === "string" && error.response.data.error.length > 0) {
    return error.response.data.error
  }

  return "Impossible d'enregistrer ce créneau."
}

export const getInitialViewMode = (): ViewMode => {
  if (typeof window === "undefined") return "list"
  const stored = window.localStorage.getItem("schedule-view-mode")
  if (stored === "grid" || stored === "list") return stored
  return window.matchMedia("(min-width: 768px)").matches ? "grid" : "list"
}

// buildListStructure stays in SchedulePage.tsx - its containment algorithm
// is the most subtle part of the page and is currently covered by component
// tests, so it is safer to keep it co-located until those tests can guard a
// move.
