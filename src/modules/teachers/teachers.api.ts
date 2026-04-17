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
  // Blocage métier — champ dédié sur la table teachers
  isBlocked: boolean
  blockReason: string | null
  blockedAt: string | null
  username: string
}

export type TeacherStats = {
  attendanceRate: number
  hoursWorked: number
  amountDue: number
}

export type TeacherMonthlyAttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused"
  | "not_marked"

export type TeacherMonthlyAttendanceRow = {
  date: string
  className: string
  subject: string
  slotLabel: string
  startTime: string
  endTime: string
  attendanceStatus: TeacherMonthlyAttendanceStatus
  lateMinutes: number | null
}

export type TeacherMonthlyAttendanceSummary = {
  hoursPlanned: number
  hoursDone: number
  totalFcfa: number | null
  status: string
}

export type TeacherMonthlyAttendanceDetails = {
  month: string
  summary: TeacherMonthlyAttendanceSummary
  rows: TeacherMonthlyAttendanceRow[]
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
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const toBoolean = (value: unknown, fallback = true): boolean =>
  typeof value === "boolean" ? value : fallback

const splitName = (name: string): { firstName: string; lastName: string } => {
  const trimmed = name.trim()
  if (!trimmed) return { firstName: "", lastName: "" }
  const chunks = trimmed.split(/\s+/)
  if (chunks.length === 1) return { firstName: chunks[0] ?? "", lastName: "" }
  return { firstName: chunks[0] ?? "", lastName: chunks.slice(1).join(" ") }
}

const normalizeSubjects = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean)
  }
  return []
}

const mapTeacher = (value: unknown): TeacherListItem => {
  const item = toRecord(value)
  const rawName = toString(item.name)
  const firstNameFromPayload = toString(item.first_name) || toString(item.firstName)
  const lastNameFromPayload = toString(item.last_name) || toString(item.lastName)

  const isActive = toBoolean(item.is_active ?? item.isActive, true)

  // is_blocked est maintenant un champ dédié sur teachers, renvoyé directement
  // par l'API. On ne le déduit plus de !isActive pour éviter les faux positifs.
  const isBlocked = toBoolean(item.is_blocked ?? item.isBlocked, false)

  // blocked_reason et blocked_at sont eux aussi des champs dédiés sur teachers.
  const blockReason = toNullableString(item.blocked_reason ?? item.blockReason)
  const blockedAt = toNullableString(item.blocked_at ?? item.blockedAt)

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
    hourlyRate:
      item.hourly_rate === null
        ? null
        : item.hourlyRate === null
          ? null
          : toNumber(item.hourly_rate ?? item.hourlyRate, 0),
    isActive,
    isBlocked,
    blockReason,
    blockedAt,
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
  if (!disposition) return null
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])
  const match = disposition.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? null
}

// ─── API functions ────────────────────────────────────────────────────────────

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

/**
 * Récupère un prof par ID via la route dédiée GET /teachers/:id.
 *
 * Remplace l'ancien pagination-scan qui parcourait toutes les pages de /teachers
 * jusqu'à trouver l'ID. Ce scan échouait (TEACHER_NOT_FOUND) si le prof venait
 * d'être bloqué et que le cache ou les filtres l'excluaient de la liste,
 * provoquant un toast d'erreur spurieux malgré un blocage réussi en base.
 */
export async function getTeacherById(teacherId: string): Promise<TeacherListItem> {
  const response = await api.get(`/teachers/${teacherId}`)
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

/**
 * Bloque un prof : écrit teachers.is_blocked = true + blocked_reason.
 * N'affecte pas users.is_active.
 */
export async function blockTeacher(
  teacherId: string,
  blockReason: string
): Promise<TeacherListItem> {
  const response = await api.put(`/teachers/${teacherId}`, {
    is_blocked: true,
    blocked_reason: blockReason.trim() || null,
  })
  
  const envelope = toRecord(response.data)
  return mapTeacher(envelope.data ?? envelope)
}

/**
 * Débloque un prof : écrit teachers.is_blocked = false, efface blocked_reason.
 */
export async function unblockTeacher(teacherId: string): Promise<TeacherListItem> {
  const response = await api.put(`/teachers/${teacherId}`, {
    is_blocked: false,
    blocked_reason: null,
  })
  const envelope = toRecord(response.data)
  return mapTeacher(envelope.data ?? envelope)
}

/**
 * @deprecated Utilisé uniquement pour la compatibilité avec du code existant.
 * Préférer blockTeacher / unblockTeacher qui ciblent le bon champ en base.
 *
 * Modifie users.is_active (accès au compte), distinct du blocage métier.
 */
export async function setTeacherActiveStatus(
  teacherId: string,
  isActive: boolean
): Promise<TeacherListItem> {
  const response = await api.put(`/teachers/${teacherId}`, {
    is_active: isActive,
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
    params: { date_from: dateFrom, date_to: dateTo },
  })

  const payload = toRecord(response.data)
  const data = toRecord(payload.data ?? payload)

  return {
    attendanceRate: toNumber(data.attendanceRate ?? data.attendance_rate, 0),
    hoursWorked: toNumber(data.hoursWorked ?? data.hours_worked, 0),
    amountDue: toNumber(data.amountDue ?? data.amount_due, 0),
  }
}

const toAttendanceStatus = (value: unknown): TeacherMonthlyAttendanceStatus => {
  if (
    value === "present" ||
    value === "absent" ||
    value === "late" ||
    value === "excused" ||
    value === "not_marked"
  ) {
    return value
  }
  return "not_marked"
}

export async function getTeacherMonthlyAttendance(
  teacherId: string,
  month: string
): Promise<TeacherMonthlyAttendanceDetails> {
  const response = await api.get(`/billing/salary/${teacherId}`, {
    params: { month },
  })

  const payload = toRecord(response.data)
  const summary = toRecord(payload.summary)
  const rowsRaw = Array.isArray(payload.rows) ? payload.rows : []

  const rows = rowsRaw.map((item): TeacherMonthlyAttendanceRow => {
    const row = toRecord(item)
    return {
      date: toString(row.date),
      className: toString(row.className, "--"),
      subject: toString(row.subject, "--"),
      slotLabel: toString(row.slotLabel, "--"),
      startTime: toString(row.startTime, "--"),
      endTime: toString(row.endTime, "--"),
      attendanceStatus: toAttendanceStatus(row.attendanceStatus),
      lateMinutes: row.lateMinutes === null ? null : toNumber(row.lateMinutes, 0),
    }
  })

  return {
    month: toString(payload.month, month),
    summary: {
      hoursPlanned: toNumber(summary.hoursPlanned, 0),
      hoursDone: toNumber(summary.hoursDone, 0),
      totalFcfa: summary.totalFcfa === null ? null : toNumber(summary.totalFcfa, 0),
      status: toString(summary.status, "pending"),
    },
    rows,
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
