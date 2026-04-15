import { z } from "zod"

import type { TeacherSchedule } from "@/modules/attendance/TeacherFlow"
import { apiClient as api } from "@/shared/api/client"

export type TeacherCatalogItem = {
  id: string
  name: string
  username: string
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
  startTime: string
  endTime: string
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
  teacher: {
    id: string
    name: string
    username: string
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
    startTime: string
    endTime: string
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
  dayOfWeek: number
  subject: string
  isActive?: boolean
}

export type ScheduleUpdatePayload = ScheduleCreatePayload

export type ImportHistoryItem = {
  id: string
  importedAt: string
  type: "students" | "teachers" | "schedule"
  importedCount: number
  updatedCount: number
}

const SchedulePeriodSchema = z.object({
  id: z.string(),
  name: z.string(),
  valid_from: z.string(),
  valid_to: z.string(),
  is_active: z.boolean()
})

const ScheduleRowSchema = z.object({
  id: z.string(),
  schedulePeriodId: z.string(),
  dayOfWeek: z.number(),
  subject: z.string(),
  teacher: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string()
  }),
  class: z.object({
    id: z.string(),
    name: z.string()
  }),
  room: z.object({
    id: z.string(),
    name: z.string(),
    qrToken: z.string()
  }),
  timeSlot: z.object({
    id: z.string(),
    label: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    sortOrder: z.number()
  })
})

const WeeklyScheduleResponseSchema = z.object({
  date: z.string(),
  period: SchedulePeriodSchema.nullable(),
  schedules: z.array(ScheduleRowSchema),
  teachers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      username: z.string()
    })
  ),
  classes: z.array(
    z.object({
      id: z.string(),
      name: z.string()
    })
  ),
  rooms: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      qrToken: z.string()
    })
  ),
  time_slots: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      startTime: z.string().optional(),
      start_time: z.string().optional(),
      endTime: z.string().optional(),
      end_time: z.string().optional(),
      sortOrder: z.number().optional(),
      sort_order: z.number().optional()
    })
  )
})

const ActiveScheduleResponseSchema = z.object({
  date: z.string(),
  dayOfWeek: z.number(),
  period: SchedulePeriodSchema.nullable(),
  schedules: z.array(ScheduleRowSchema)
})

const ImportHistoryItemSchema = z.object({
  id: z.string(),
  imported_at: z.string(),
  type: z.enum(["students", "teachers", "schedule"]),
  imported_count: z.number(),
  updated_count: z.number()
})

const ImportHistoryResponseSchema = z.object({
  items: z.array(ImportHistoryItemSchema).default([])
})

const toSchedulePayload = (payload: ScheduleCreatePayload) => ({
  schedule_period_id: payload.schedulePeriodId,
  teacher_id: payload.teacherId,
  class_id: payload.classId,
  room_id: payload.roomId,
  time_slot_id: payload.timeSlotId,
  day_of_week: payload.dayOfWeek,
  subject: payload.subject,
  is_active: payload.isActive
})

const toIsoDateTime = (date: string, time: string): string => {
  return `${date}T${time}.000Z`
}

export const fetchTeacherSchedule = async (): Promise<TeacherSchedule[]> => {
  const response = await api.get("/schedule/teacher/me")
  const payload = response.data as { date?: string; schedules?: ScheduleRow[] } | ScheduleRow[]

  const date =
    (typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    typeof payload.date === "string"
      ? payload.date
      : new Date().toISOString().slice(0, 10))

  const schedules = Array.isArray(payload) ? payload : payload.schedules ?? []

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

export const fetchActiveSchedules = async (): Promise<ActiveScheduleData> => {
  const response = await api.get("/schedule/active")
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
          isActive: parsed.period.is_active
        }
      : null,
    schedules: parsed.schedules
  }
}

export const fetchWeeklySchedule = async (): Promise<WeeklyScheduleData> => {
  const response = await api.get("/schedule/weekly")
  const parsed = WeeklyScheduleResponseSchema.parse(response.data)

  return {
    date: parsed.date,
    period: parsed.period
      ? {
          id: parsed.period.id,
          name: parsed.period.name,
          validFrom: parsed.period.valid_from,
          validTo: parsed.period.valid_to,
          isActive: parsed.period.is_active
        }
      : null,
    schedules: parsed.schedules,
    catalog: {
      teachers: parsed.teachers,
      classes: parsed.classes,
      rooms: parsed.rooms,
      timeSlots: parsed.time_slots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        startTime: slot.startTime ?? slot.start_time ?? "",
        endTime: slot.endTime ?? slot.end_time ?? "",
        sortOrder: slot.sortOrder ?? slot.sort_order ?? 0
      }))
    }
  }
}

export const createScheduleSlot = async (payload: ScheduleCreatePayload): Promise<{ id: string }> => {
  const response = await api.post<{ schedule: { id: string } }>("/schedule", toSchedulePayload(payload))
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

export const fetchImportHistory = async (limit = 20): Promise<ImportHistoryItem[]> => {
  const response = await api.get("/import/history", {
    params: { limit }
  })
  const parsed = ImportHistoryResponseSchema.parse(response.data)

  return parsed.items.map((item) => ({
    id: item.id,
    importedAt: item.imported_at,
    type: item.type,
    importedCount: item.imported_count,
    updatedCount: item.updated_count
  }))
}
