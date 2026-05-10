import { z } from "zod"

import type { TeacherSchedule } from "@/modules/attendance/TeacherFlow"
import { apiClient as api } from "@/shared/api/client"
import { normalizeTime } from "@/shared/utils/time"

// ─── Types publics ─────────────────────────────────────────────────────────────

export type TeacherCatalogItem = {
  id: string
  name: string
  username: string
  isBlocked?: boolean
  subjects: string[]
}

export type ClassCatalogItem = {
  id: string
  name: string
}

export type RoomCatalogItem = {
  id: string
  name: string
  qrToken: string
}

export type TimeSlotCatalogItem = {
  id: string
  label: string
  startTime: string  // toujours "HH:MM" normalisé
  endTime: string    // toujours "HH:MM" normalisé
  sortOrder: number
}

export type SchedulePeriod = {
  id: string
  name: string
  validFrom: string
  validTo: string
  isActive: boolean
}

export type ScheduleRow = {
  id: string
  schedulePeriodId: string
  dayOfWeek: number
  subject: string
  pastAttendanceCount: number
  hasPastAttendance: boolean
  teacher: {
    id: string
    name: string
    username: string
    isBlocked?: boolean
  }
  class: {
    id: string
    name: string
  }
  room: {
    id: string
    name: string
    qrToken: string
  }
  timeSlot: {
    id: string
    label: string
    startTime: string  // toujours "HH:MM" normalisé
    endTime: string    // toujours "HH:MM" normalisé
    sortOrder: number
  }
}

export type ScheduleCatalog = {
  teachers: TeacherCatalogItem[]
  classes: ClassCatalogItem[]
  rooms: RoomCatalogItem[]
  timeSlots: TimeSlotCatalogItem[]
}

export type WeeklyScheduleData = {
  date: string
  period: SchedulePeriod | null
  schedules: ScheduleRow[]
  catalog: ScheduleCatalog
}

export type ActiveScheduleData = {
  date: string
  dayOfWeek: number
  period: SchedulePeriod | null
  schedules: ScheduleRow[]
}

export type ScheduleCreatePayload = {
  schedulePeriodId: string
  teacherId: string
  classId: string
  roomId: string
  timeSlotId: string
  startTime?: string
  endTime?: string
  dayOfWeek: number
  subject: string
  effectiveFrom?: string
  isActive?: boolean
}

export type ScheduleUpdatePayload = ScheduleCreatePayload

// ─── Normalisation des heures ─────────────────────────────────────────────────
//
// PostgreSQL retourne les colonnes `time` castées en `::text` sous la forme
// "HH:MM:SS" (ex: "07:30:00"). Le frontend utilise "HH:MM" partout.
// On normalise à la source dans fetchWeeklySchedule pour que toutes les
// comparaisons de clés (scheduleByDayAndTime) soient cohérentes.
//
// QUALITÉ FIX : normalizeTime déplacé vers shared/utils/time.ts

// ─── Schémas Zod ──────────────────────────────────────────────────────────────

const SchedulePeriodSchema = z.object({
  id: z.string(),
  name: z.string(),
  valid_from: z.string(),
  valid_to: z.string(),
  is_active: z.boolean(),
})

// On accepte les deux formats de temps depuis le backend ("HH:MM" et "HH:MM:SS")
// La normalisation se fait après le parse.
const ScheduleRowSchema = z.object({
  id: z.string(),
  schedulePeriodId: z.string(),
  dayOfWeek: z.number(),
  subject: z.string(),
  pastAttendanceCount: z.number().optional().default(0),
  hasPastAttendance: z.boolean().optional().default(false),
  teacher: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
  }),
  class: z.object({
    id: z.string(),
    name: z.string(),
  }),
  room: z.object({
    id: z.string(),
    name: z.string(),
    qrToken: z.string(),
  }),
  timeSlot: z.object({
    id: z.string(),
    label: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    sortOrder: z.number(),
  }),
})

const WeeklyScheduleResponseSchema = z.object({
  date: z.string(),
  period: SchedulePeriodSchema.nullable(),
  schedules: z.array(ScheduleRowSchema),
  teachers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      username: z.string(),
      is_blocked: z.boolean().optional(),
      isBlocked: z.boolean().optional(),
      subjects: z.array(z.string()).default([]),
    })
  ),
  classes: z.array(z.object({ id: z.string(), name: z.string() })),
  rooms: z.array(z.object({ id: z.string(), name: z.string(), qrToken: z.string() })),
  time_slots: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      startTime: z.string().optional(),
      start_time: z.string().optional(),
      endTime: z.string().optional(),
      end_time: z.string().optional(),
      sortOrder: z.number().optional(),
      sort_order: z.number().optional(),
    })
  ),
})

const ActiveScheduleResponseSchema = z.object({
  date: z.string(),
  dayOfWeek: z.number(),
  period: SchedulePeriodSchema.nullable(),
  schedules: z.array(ScheduleRowSchema),
})

const SchedulePeriodsResponseSchema = z.object({
  periods: z
    .array(z.object({ valid_from: z.string(), valid_to: z.string(), is_active: z.boolean() }))
    .default([]),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toSchedulePayload = (payload: ScheduleCreatePayload) => ({
  schedule_period_id: payload.schedulePeriodId,
  teacher_id: payload.teacherId,
  class_id: payload.classId,
  room_id: payload.roomId,
  ...(payload.timeSlotId ? { time_slot_id: payload.timeSlotId } : {}),
  ...(payload.startTime ? { start_time: payload.startTime } : {}),
  ...(payload.endTime ? { end_time: payload.endTime } : {}),
  day_of_week: payload.dayOfWeek,
  subject: payload.subject,
  ...(payload.effectiveFrom ? { effective_from: payload.effectiveFrom } : {}),
  is_active: payload.isActive,
})

const toIsoDateTime = (date: string, time: string): string => `${date}T${normalizeTime(time)}:00.000Z`

const getDateParam = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined

// ─── API Functions ────────────────────────────────────────────────────────────

export const fetchTeacherSchedule = async (): Promise<TeacherSchedule[]> => {
  const response = await api.get("/schedule/teacher/me")
  const payload = response.data as
    | { date?: string; schedules?: ScheduleRow[] }
    | ScheduleRow[]

  const date =
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    typeof payload.date === "string"
      ? payload.date
      : new Date().toISOString().slice(0, 10)

  const schedules = Array.isArray(payload) ? payload : (payload.schedules ?? [])

  return schedules.map((item) => ({
    id: item.id,
    class_id: item.class.id,
    class_name: item.class.name,
    subject_name: item.subject,
    room_id: item.room.id,
    room_name: item.room.name,
    start_at: toIsoDateTime(date, item.timeSlot.startTime),
    end_at: toIsoDateTime(date, item.timeSlot.endTime),
  }))
}

export const fetchActiveSchedules = async (date?: unknown): Promise<ActiveScheduleData> => {
  const resolvedDate = getDateParam(date)
  const response = await api.get("/schedule/active", {
    params: resolvedDate ? { date: resolvedDate } : {},
  })
  const parsed = ActiveScheduleResponseSchema.parse(response.data)

  return {
    date: parsed.date,
    dayOfWeek: parsed.dayOfWeek,
    period: parsed.period
      ? {
          id: parsed.period.id,
          name: parsed.period.name,
          validFrom: parsed.period.valid_from,
          validTo: parsed.period.valid_to,
          isActive: parsed.period.is_active,
        }
      : null,
    // Normaliser les heures des schedules de la vue active aussi
    schedules: parsed.schedules.map((s) => ({
      ...s,
      pastAttendanceCount: s.pastAttendanceCount ?? 0,
      hasPastAttendance: s.hasPastAttendance ?? (s.pastAttendanceCount ?? 0) > 0,
      timeSlot: {
        ...s.timeSlot,
        startTime: normalizeTime(s.timeSlot.startTime),
        endTime: normalizeTime(s.timeSlot.endTime),
      },
    })),
  }
}

export const fetchWeeklySchedule = async (date?: unknown): Promise<WeeklyScheduleData> => {
  const resolvedDate = getDateParam(date)
  const response = await api.get("/schedule/weekly", {
    params: resolvedDate ? { date: resolvedDate } : {},
  })
  const parsed = WeeklyScheduleResponseSchema.parse(response.data)

  // Normaliser tous les temps en "HH:MM" — source unique de vérité pour les clés de lookup
  const normalizedTimeSlots: TimeSlotCatalogItem[] = parsed.time_slots.map((slot) => ({
    id: slot.id,
    label: slot.label,
    startTime: normalizeTime(slot.startTime ?? slot.start_time ?? ""),
    endTime: normalizeTime(slot.endTime ?? slot.end_time ?? ""),
    sortOrder: slot.sortOrder ?? slot.sort_order ?? 0,
  }))

  const normalizedSchedules: ScheduleRow[] = parsed.schedules.map((s) => ({
    ...s,
    pastAttendanceCount: s.pastAttendanceCount ?? 0,
    hasPastAttendance: s.hasPastAttendance ?? (s.pastAttendanceCount ?? 0) > 0,
    timeSlot: {
      ...s.timeSlot,
      startTime: normalizeTime(s.timeSlot.startTime),
      endTime: normalizeTime(s.timeSlot.endTime),
    },
  }))

  return {
    date: parsed.date,
    period: parsed.period
      ? {
          id: parsed.period.id,
          name: parsed.period.name,
          validFrom: parsed.period.valid_from,
          validTo: parsed.period.valid_to,
          isActive: parsed.period.is_active,
        }
      : null,
    schedules: normalizedSchedules,
    catalog: {
      teachers: parsed.teachers.map((teacher) => ({
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        isBlocked:
          typeof teacher.is_blocked === "boolean"
            ? teacher.is_blocked
            : typeof teacher.isBlocked === "boolean"
              ? teacher.isBlocked
              : undefined,
        subjects: teacher.subjects,
      })),
      classes: parsed.classes,
      rooms: parsed.rooms,
      timeSlots: normalizedTimeSlots,
    },
  }
}

const toDateOnly = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
}

const hasDateOverlap = (startA: Date, endA: Date, startB: Date, endB: Date): boolean =>
  startA <= endB && startB <= endA

export const fetchNextWeekCoverage = async (nextWeekMonday: string): Promise<boolean> => {
  const active = await fetchActiveSchedules(nextWeekMonday)
  if (active.period) return true

  const response = await api.get("/schedule/periods")
  const parsed = SchedulePeriodsResponseSchema.parse(response.data)
  const nextWeekStart = toDateOnly(nextWeekMonday)
  const nextWeekEnd = new Date(nextWeekStart)
  nextWeekEnd.setUTCDate(nextWeekEnd.getUTCDate() + 6)

  return parsed.periods.some((period) => {
    if (!period.is_active) return false
    return hasDateOverlap(
      toDateOnly(period.valid_from),
      toDateOnly(period.valid_to),
      nextWeekStart,
      nextWeekEnd
    )
  })
}

export const createScheduleSlot = async (
  payload: ScheduleCreatePayload
): Promise<{ id: string }> => {
  const response = await api.post<{ schedule: { id: string } }>(
    "/schedule",
    toSchedulePayload(payload)
  )
  return response.data.schedule
}

export const updateScheduleSlot = async (
  scheduleId: string,
  payload: ScheduleUpdatePayload
): Promise<{ id: string }> => {
  const response = await api.put<{ schedule: { id: string } }>(
    `/schedule/${scheduleId}`,
    toSchedulePayload(payload)
  )
  return response.data.schedule
}

export const deleteScheduleSlot = async (scheduleId: string): Promise<void> => {
  await api.delete(`/schedule/${scheduleId}`)
}

export const deleteScheduleSlotFromDate = async (
  scheduleId: string,
  effectiveFrom: string
): Promise<void> => {
  await api.delete(`/schedule/${scheduleId}`, {
    params: { effective_from: effectiveFrom },
  })
}

