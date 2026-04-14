import { apiClient as api } from "@/shared/api/client"

export type TeacherType = "vacataire" | "permanent"

export type TeacherListItem = {
  id: string
  firstName: string
  lastName: string
  fullName: string
  phone: string | null
  type: TeacherType
  subjects: string[]
  hourlyRate: number | null
  isActive: boolean
  username: string
}

export type TeacherStats = {
  attendanceRate: number
  hoursWorked: number
  amountDue: number
}

export type TeachersPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type TeachersListResponse = {
  data: TeacherListItem[]
  pagination: TeachersPagination
}

export type GetTeachersParams = {
  page?: number
  limit?: number
  type?: TeacherType | "all"
  is_active?: boolean | "all"
  subject?: string
  search?: string
}

export type TeacherUpsertPayload = {
  firstName: string
  lastName: string
  phone: string | null
  type: TeacherType
  subjects: string[]
  hourlyRate: number | null
}

export type ExportTeacherHoursInput = {
  teacherId: string
  dateFrom: string
  dateTo: string
}

type UnknownRecord = Record<string, unknown>

const toRecord = (value: unknown): UnknownRecord =>
  typeof value === "object" && value !== null ? (value as UnknownRecord) : {}

const toString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback

const toNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

const toBoolean = (value: unknown, fallback = true): boolean =>
  typeof value === "boolean" ? value : fallback

const splitName = (name: string): { firstName: string; lastName: string } => {
  const trimmed = name.trim()
  if (!trimmed) {
    return { firstName: "", lastName: "" }
  }

  const chunks = trimmed.split(/\s+/)
  if (chunks.length === 1) {
    return { firstName: chunks[0], lastName: "" }
  }

  return {
    firstName: chunks[0],
    lastName: chunks.slice(1).join(" "),
  }
}

const normalizeSubjects = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

const mapTeacher = (value: unknown): TeacherListItem => {
  const item = toRecord(value)
  const rawName = toString(item.name)
  const firstNameFromPayload = toString(item.first_name) || toString(item.firstName)
  const lastNameFromPayload = toString(item.last_name) || toString(item.lastName)

  const fromName = splitName(rawName)
  const firstName = firstNameFromPayload || fromName.firstName || "Prof"
  const lastName = lastNameFromPayload || fromName.lastName || ""
  const fullName = `${firstName} ${lastName}`.trim()

  return {
    id: toString(item.id),
    firstName,
    lastName,
    fullName,
    phone: toNullableString(item.phone),
    type: (toString(item.type) === "permanent" ? "permanent" : "vacataire") as TeacherType,
    subjects: normalizeSubjects(item.subjects ?? item.subject),
    hourlyRate: item.hourly_rate === null ? null : item.hourlyRate === null ? null : toNumber(item.hourly_rate ?? item.hourlyRate, 0),
    isActive: toBoolean(item.is_active ?? item.isActive, true),
    username: toString(item.username),
  }
}

const mapPagination = (value: unknown, defaults?: GetTeachersParams): TeachersPagination => {
  const pagination = toRecord(value)
  const page = toNumber(pagination.page, defaults?.page ?? 1)
  const limit = toNumber(pagination.limit, defaults?.limit ?? 10)
  const total = toNumber(pagination.total, 0)
  const totalPages = toNumber(
    pagination.totalPages ?? pagination.total_pages,
    total === 0 ? 0 : Math.ceil(total / Math.max(1, limit))
  )

  return { page, limit, total, totalPages }
}

const extractFilename = (disposition?: string) => {
  if (!disposition) {
    return null
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const match = disposition.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? null
}

export async function getTeachers(params: GetTeachersParams = {}): Promise<TeachersListResponse> {
  const response = await api.get("/teachers", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
      ...(params.type && params.type !== "all" ? { type: params.type } : {}),
      ...(typeof params.is_active === "boolean" ? { is_active: params.is_active } : {}),
      ...(params.subject ? { subject: params.subject } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
  })

  const payload = toRecord(response.data)
  const rawData = Array.isArray(response.data)
    ? response.data
    : Array.isArray(payload.data)
      ? payload.data
      : []

  return {
    data: rawData.map(mapTeacher),
    pagination: mapPagination(payload.pagination, params),
  }
}

export async function createTeacher(payload: TeacherUpsertPayload): Promise<TeacherListItem> {
  const response = await api.post("/teachers", {
    first_name: payload.firstName,
    last_name: payload.lastName,
    phone: payload.phone,
    type: payload.type,
    subjects: payload.subjects,
    hourly_rate: payload.hourlyRate,
  })

  const envelope = toRecord(response.data)
  return mapTeacher(envelope.data ?? envelope)
}

export async function updateTeacher(
  teacherId: string,
  payload: TeacherUpsertPayload
): Promise<TeacherListItem> {
  const response = await api.put(`/teachers/${teacherId}`, {
    first_name: payload.firstName,
    last_name: payload.lastName,
    phone: payload.phone,
    type: payload.type,
    subjects: payload.subjects,
    hourly_rate: payload.hourlyRate,
  })

  const envelope = toRecord(response.data)
  return mapTeacher(envelope.data ?? envelope)
}

export async function softDeleteTeacher(teacherId: string): Promise<TeacherListItem> {
  const response = await api.delete(`/teachers/${teacherId}`)
  const envelope = toRecord(response.data)
  return mapTeacher(envelope.data ?? envelope)
}

export async function getTeacherStats(
  teacherId: string,
  dateFrom: string,
  dateTo: string
): Promise<TeacherStats> {
  const response = await api.get(`/teachers/${teacherId}/stats`, {
    params: {
      date_from: dateFrom,
      date_to: dateTo,
    },
  })

  const payload = toRecord(response.data)
  const data = toRecord(payload.data ?? payload)

  return {
    attendanceRate: toNumber(data.attendanceRate ?? data.attendance_rate, 0),
    hoursWorked: toNumber(data.hoursWorked ?? data.hours_worked, 0),
    amountDue: toNumber(data.amountDue ?? data.amount_due, 0),
  }
}

export async function exportTeacherHours(input: ExportTeacherHoursInput): Promise<{
  blob: Blob
  filename: string
}> {
  const response = await api.get<Blob>("/attendance/history/export", {
    responseType: "blob",
    params: {
      teacherId: input.teacherId,
      date_from: input.dateFrom,
      date_to: input.dateTo,
      format: "xlsx",
    },
  })

  return {
    blob: response.data,
    filename:
      extractFilename(response.headers["content-disposition"]) ??
      `edutrack-heures-${input.teacherId}.xlsx`,
  }
}
