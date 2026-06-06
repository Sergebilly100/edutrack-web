import { apiClient as api } from "@/shared/api/client"
import { asBoolean, asNullableString, asNumber, asString, isRecord } from "@/shared/utils/parsers"

export type TeacherType = "vacataire" | "permanent"

export type TeacherListItem = {
  id: string
  firstName: string
  lastName: string
  fullName: string
  matricule: string | null
  phone: string | null
  email: string | null
  type: TeacherType
  subjects: string[]
  hourlyRate: number | null
  monthlySalary: number | null
  isActive: boolean
  // Blocage métier - champ dédié sur la table teachers
  isBlocked: boolean
  blockReason: string | null
  blockedAt: string | null
  username: string
  updatedAt: string | null
  updatedBy: string | null
  updatedByName: string | null
}

export type TeacherStats = {
  attendanceRate: number
  hoursWorked: number
  amountDue: number
}

export type TeacherAttendanceStats = {
  teacher_id: string
  teacher_name: string
  teacher_matricule: string | null
  teacher_type: "vacataire" | "permanent"
  subjects: string[]
  total_scheduled: number
  present_count: number
  absent_count: number
  late_count: number
  room_mismatch_count: number
  rollcall_done_count: number
  rollcall_missing_count: number
  attendance_rate: number
  hours_scheduled: number
  hours_done: number
}

export type ClassOption = {
  id: string
  name: string
}

export type TeacherOption = {
  id: string
  name: string
  matricule: string | null
  subjects: string[]
}

export type TeacherMonthlyAttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "not_marked"

export type TeacherMonthlyAttendanceRow = {
  date: string
  scheduleId: string | null
  className: string
  subject: string
  dayOfWeek?: number
  slotLabel: string
  startTime: string
  endTime: string
  attendanceStatus: TeacherMonthlyAttendanceStatus
  checkedInAt: string | null
  checkedOutAt: string | null
  lateMinutes: number | null
  roomMismatch: boolean
  rollcallDone: boolean
  rollcallMissing: boolean
  hoursPlanned: number
  hoursDone: number
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
  matricule: string | null
  phone: string | null
  email: string | null
  type: TeacherType
  subjects: string[]
  hourlyRate: number | null
  monthlySalary: number | null
}

export type ExportTeacherHoursInput = {
  teacherId: string
  dateFrom: string
  dateTo: string
}

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}

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
  const rawName = asString(item.name)
  const firstNameFromPayload = asString(item.first_name) || asString(item.firstName)
  const lastNameFromPayload = asString(item.last_name) || asString(item.lastName)

  const isActive = asBoolean(item.is_active ?? item.isActive, true)

  // is_blocked est maintenant un champ dédié sur teachers, renvoyé directement
  // par l'API. On ne le déduit plus de !isActive pour éviter les faux positifs.
  const isBlocked = asBoolean(item.is_blocked ?? item.isBlocked, false)

  // blocked_reason et blocked_at sont eux aussi des champs dédiés sur teachers.
  const blockReason = asNullableString(item.blocked_reason ?? item.blockReason)
  const blockedAt = asNullableString(item.blocked_at ?? item.blockedAt)

  const fromName = splitName(rawName)
  const firstName = firstNameFromPayload || fromName.firstName || "Prof"
  const lastName = lastNameFromPayload || fromName.lastName || ""
  const fullName = `${firstName} ${lastName}`.trim()

  return {
    id: asString(item.id),
    firstName,
    lastName,
    fullName,
    matricule: asNullableString(item.matricule),
    phone: asNullableString(item.phone),
    email: asNullableString(item.email),
    type: (asString(item.type) === "permanent" ? "permanent" : "vacataire") as TeacherType,
    subjects: normalizeSubjects(item.subjects ?? item.subject),
    hourlyRate:
      item.hourly_rate === null
        ? null
        : item.hourlyRate === null
          ? null
          : asNumber(item.hourly_rate ?? item.hourlyRate, 0),
    monthlySalary:
      item.monthly_salary === null || item.monthlySalary === null
        ? null
        : item.monthly_salary === undefined && item.monthlySalary === undefined
          ? null
          : asNumber(item.monthly_salary ?? item.monthlySalary, 0),
    isActive,
    isBlocked,
    blockReason,
    blockedAt,
    username: asString(item.username),
    updatedAt: asNullableString(item.updated_at ?? item.updatedAt),
    updatedBy: asNullableString(item.updated_by ?? item.updatedBy),
    updatedByName: asNullableString(item.updated_by_name ?? item.updatedByName),
  }
}

const mapPagination = (value: unknown, defaults?: GetTeachersParams): TeachersPagination => {
  const pagination = toRecord(value)
  const page = asNumber(pagination.page, defaults?.page ?? 1)
  const limit = asNumber(pagination.limit, defaults?.limit ?? 10)
  const total = asNumber(pagination.total, 0)
  const totalPages = asNumber(
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
    matricule: payload.matricule,
    phone: payload.phone,
    email: payload.email,
    type: payload.type,
    subjects: payload.subjects,
    hourly_rate: payload.hourlyRate,
    monthly_salary: payload.monthlySalary,
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
    matricule: payload.matricule,
    phone: payload.phone,
    email: payload.email,
    type: payload.type,
    subjects: payload.subjects,
    hourly_rate: payload.hourlyRate,
    monthly_salary: payload.monthlySalary,
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

export type ResetPasswordResult = {
  emailSent: boolean
  email: string | null
  plainPassword?: string
}

export async function resetTeacherPassword(teacherId: string): Promise<ResetPasswordResult> {
  const response = await api.post(`/teachers/${teacherId}/reset-password`, {})
  const data = toRecord(response.data)
  return {
    emailSent: asBoolean(data.emailSent, false),
    email: asNullableString(data.email),
    plainPassword: typeof data.plainPassword === "string" ? data.plainPassword : undefined,
  }
}

export type SendCredentialsResult = {
  sentCount: number
  skippedNoEmailCount: number
  failedCount: number
  skippedNoEmail: Array<{ teacherId: string; name: string }>
}

export async function sendCredentialsToTeachers(
  teacherIds?: string[]
): Promise<SendCredentialsResult> {
  const response = await api.post(
    `/teachers/send-credentials`,
    teacherIds && teacherIds.length > 0 ? { teacher_ids: teacherIds } : {}
  )
  const data = toRecord(response.data)
  const skipped = Array.isArray(data.skippedNoEmail) ? data.skippedNoEmail : []
  return {
    sentCount: asNumber(data.sentCount, 0),
    skippedNoEmailCount: asNumber(data.skippedNoEmailCount, 0),
    failedCount: asNumber(data.failedCount, 0),
    skippedNoEmail: skipped.map((entry) => {
      const item = toRecord(entry)
      return { teacherId: asString(item.teacherId), name: asString(item.name) }
    }),
  }
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
    attendanceRate: asNumber(data.attendanceRate ?? data.attendance_rate, 0),
    hoursWorked: asNumber(data.hoursWorked ?? data.hours_worked, 0),
    amountDue: asNumber(data.amountDue ?? data.amount_due, 0),
  }
}

const toAttendanceStatus = (value: unknown): TeacherMonthlyAttendanceStatus => {
  if (
    value === "present" ||
    value === "absent" ||
    value === "late" ||
    value === "not_marked"
  ) {
    return value
  }
  // Donnée legacy 'excused' ou inconnu → traité comme 'present'.
  if (value === "excused") return "present"
  return "not_marked"
}

export async function getTeacherMonthlyAttendance(
  teacherId: string,
  month: string
): Promise<TeacherMonthlyAttendanceDetails> {
  const response = await api.get(`/attendance/teachers/${teacherId}/monthly`, {
    params: { month },
  })

  const payload = toRecord(response.data)
  const summary = toRecord(payload.summary)
  const rowsRaw = Array.isArray(payload.rows) ? payload.rows : []

  const rows = rowsRaw.map((item): TeacherMonthlyAttendanceRow => {
    const row = toRecord(item)
    return {
      date: asString(row.date),
      scheduleId: asNullableString(row.scheduleId),
      className: asString(row.className, "--"),
      subject: asString(row.subject, "--"),
      dayOfWeek: asNumber(row.dayOfWeek, 0),
      slotLabel: asString(row.slotLabel, "--"),
      startTime: asString(row.startTime, "--"),
      endTime: asString(row.endTime, "--"),
      attendanceStatus: toAttendanceStatus(row.attendanceStatus),
      checkedInAt: asNullableString(row.checkedInAt),
      checkedOutAt: asNullableString(row.checkedOutAt),
      lateMinutes: row.lateMinutes === null ? null : asNumber(row.lateMinutes, 0),
      roomMismatch: asBoolean(row.roomMismatch, false),
      rollcallDone: asBoolean(row.rollcallDone, false),
      rollcallMissing: asBoolean(row.rollcallMissing, false),
      hoursPlanned: asNumber(row.hoursPlanned, 0),
      hoursDone: asNumber(row.hoursDone, 0),
    }
  })

  return {
    month: asString(payload.month, month),
    summary: {
      hoursPlanned: asNumber(summary.hoursPlanned, 0),
      hoursDone: asNumber(summary.hoursDone, 0),
      totalFcfa: summary.totalFcfa === null ? null : asNumber(summary.totalFcfa, 0),
      status: asString(summary.status, "pending"),
    },
    rows,
  }
}

/**
 * Lance la génération du bilan PDF des heures d'un professeur sur une période
 * (job asynchrone). Remplace l'ancien export Excel synchrone : le serveur enfile
 * un job et renvoie un jobId, le frontend poll /jobs/:id/status puis télécharge
 * le PDF brandé.
 */
export async function exportTeacherHours(
  input: ExportTeacherHoursInput
): Promise<{ jobId: string }> {
  const response = await api.get("/attendance/history/export", {
    params: {
      teacherId: input.teacherId,
      date_from: input.dateFrom,
      date_to: input.dateTo,
    },
  })

  const payload = (response.data ?? {}) as { jobId?: string | number }
  return { jobId: String(payload.jobId ?? "") }
}

export const fetchTeacherAttendanceStats = async (params: {
  from: string
  to: string
  subject?: string
  class_id?: string
  teacher_id?: string
  status_filter?: "absent" | "room_mismatch" | "rollcall_missing" | "late"
}): Promise<TeacherAttendanceStats[]> => {
  const response = await api.get("/teachers/attendance-stats", { params })
  const payload = response.data
  return Array.isArray(payload)
    ? (payload as TeacherAttendanceStats[])
    : Array.isArray((payload as Record<string, unknown>).data)
      ? ((payload as Record<string, unknown>).data as TeacherAttendanceStats[])
      : []
}

/**
 * Lance la génération du bilan PDF de présence des professeurs (job asynchrone).
 * Remplace l'ancien export CSV navigateur. Les filtres « all » sont omis car le
 * serveur n'accepte que des filtres concrets.
 */
export const exportTeacherAttendanceStats = async (params: {
  from: string
  to: string
  subject?: string
  class_id?: string
  teacher_id?: string
  status_filter?: "all" | "absent" | "room_mismatch" | "rollcall_missing" | "late"
}): Promise<{ jobId: string }> => {
  const omitAll = (value?: string) => (value && value !== "all" ? value : undefined)
  const response = await api.get("/teachers/attendance-stats/export", {
    params: {
      from: params.from,
      to: params.to,
      subject: omitAll(params.subject),
      class_id: omitAll(params.class_id),
      teacher_id: omitAll(params.teacher_id),
      status_filter: params.status_filter === "all" ? undefined : params.status_filter,
    },
  })
  const payload = (response.data ?? {}) as { jobId?: string | number }
  return { jobId: String(payload.jobId ?? "") }
}

export const fetchClasses = async (): Promise<ClassOption[]> => {
  const fallback = await api.get("/schedule/weekly")
  const payload = toRecord(fallback.data)
  const data = Array.isArray(payload.classes) ? payload.classes : []

  return data.map((item) => {
    const row = toRecord(item)
    return {
      id: asString(row.id),
      name: asString(row.name),
    }
  })
}

export const fetchTeacherOptions = async (): Promise<TeacherOption[]> => {
  const response = await getTeachers({ page: 1, limit: 200, is_active: true })
  return response.data.map((teacher) => ({
    id: teacher.id,
    name: teacher.fullName,
    matricule: teacher.matricule,
    subjects: teacher.subjects,
  }))
}

// Re-exports to avoid cross-module imports in TeachersPage / TeacherDetailPage
export { getTeacherCompliance, type DashboardTeacherComplianceItem } from "@/modules/dashboard/dashboard.api"
export { getTeacherSalaryDetails, type SalaryTeacherDetails } from "@/modules/salaries/salaries.api"
export { fetchWeeklySchedule } from "@/modules/schedule/schedule.api"
