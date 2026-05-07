import { apiClient as api } from "@/shared/api/client"

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const parsed = asNumber(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : null
}

export type ValidationKind = "gps_suspicious" | "short_hours"

export type PendingValidationItem = {
  attendanceId: string
  teacherId: string
  teacherName: string
  courseName: string
  className: string
  date: string
  checkedInAt: string | null
  checkedOutAt: string | null
  geoStatus: "verified" | "suspicious" | "unavailable" | "not_checked" | null
  checkinDistance: number | null
  actualMinutes: number | null
  scheduleDurationMinutes: number
  validationReason: string | null
  hourlyRate: number | null
  kind: ValidationKind
}

export type PendingValidationGroups = {
  gps_suspicious: PendingValidationItem[]
  short_hours: PendingValidationItem[]
}

export type PendingValidationCount = {
  gps_suspicious: number
  short_hours: number
  total: number
}

const normalizeItem = (value: unknown): PendingValidationItem => {
  const row = isRecord(value) ? value : {}
  const kind = row.kind === "gps_suspicious" ? "gps_suspicious" : "short_hours"
  return {
    attendanceId: asString(row.attendanceId ?? row.attendance_id),
    teacherId: asString(row.teacherId ?? row.teacher_id),
    teacherName: asString(row.teacherName ?? row.teacher_name, "Enseignant"),
    courseName: asString(row.courseName ?? row.course_name, "Cours"),
    className: asString(row.className ?? row.class_name, "Classe"),
    date: asString(row.date),
    checkedInAt: asNullableString(row.checkedInAt ?? row.checked_in_at),
    checkedOutAt: asNullableString(row.checkedOutAt ?? row.checked_out_at),
    geoStatus:
      row.geoStatus === "verified" ||
      row.geoStatus === "suspicious" ||
      row.geoStatus === "unavailable" ||
      row.geoStatus === "not_checked"
        ? row.geoStatus
        : null,
    checkinDistance: asNullableNumber(row.checkinDistance ?? row.checkin_distance),
    actualMinutes: asNullableNumber(row.actualMinutes ?? row.actual_minutes),
    scheduleDurationMinutes: asNumber(row.scheduleDurationMinutes ?? row.schedule_duration_minutes),
    validationReason: asNullableString(row.validationReason ?? row.validation_reason),
    hourlyRate: asNullableNumber(row.hourlyRate ?? row.hourly_rate),
    kind,
  }
}

export const getPendingValidations = async (): Promise<PendingValidationGroups> => {
  const response = await api.get<unknown>("/validations/pending")
  const payload = isRecord(response.data) ? response.data : {}
  return {
    gps_suspicious: Array.isArray(payload.gps_suspicious)
      ? payload.gps_suspicious.map(normalizeItem)
      : [],
    short_hours: Array.isArray(payload.short_hours)
      ? payload.short_hours.map(normalizeItem)
      : [],
  }
}

export const getPendingValidationCount = async (): Promise<PendingValidationCount> => {
  const response = await api.get<unknown>("/validations/pending/count")
  const payload = isRecord(response.data) ? response.data : {}
  return {
    gps_suspicious: asNumber(payload.gps_suspicious),
    short_hours: asNumber(payload.short_hours),
    total: asNumber(payload.total),
  }
}

export const approveValidation = async (input: {
  attendanceId: string
  validatedHours?: number
}): Promise<void> => {
  await api.patch(
    `/validations/${input.attendanceId}/approve`,
    input.validatedHours === undefined ? {} : { validated_hours: input.validatedHours }
  )
}

export const rejectValidation = async (input: {
  attendanceId: string
  reason: string
}): Promise<void> => {
  await api.patch(`/validations/${input.attendanceId}/reject`, { reason: input.reason })
}
