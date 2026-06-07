import { apiClient as api } from "@/shared/api/client"
import { asNullableString, asNumber, asString, isRecord } from "@/shared/utils/parsers"

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
  /** Onglet primaire d'affichage. */
  kind: ValidationKind
  /** Tous les critères déclenchés (>= 1). Permet d'afficher plusieurs badges. */
  kinds: ValidationKind[]
  slotLabel: string | null
  roomName: string | null
}

export type PendingValidationGroups = {
  gps_suspicious: PendingValidationItem[]
  short_hours: PendingValidationItem[]
}

export type PendingValidationCount = {
  gps_suspicious: number
  short_hours: number
  missing_end_scan: number
  total: number
}

const normalizeKind = (value: unknown): ValidationKind =>
  value === "gps_suspicious" ? "gps_suspicious" : "short_hours"

const normalizeKindsArray = (value: unknown, fallback: ValidationKind): ValidationKind[] => {
  if (!Array.isArray(value)) return [fallback]
  const result = value
    .map((v) => (v === "gps_suspicious" || v === "short_hours" ? (v as ValidationKind) : null))
    .filter((v): v is ValidationKind => v !== null)
  return result.length > 0 ? result : [fallback]
}

const normalizeItem = (value: unknown): PendingValidationItem => {
  const row = isRecord(value) ? value : {}
  const kind = normalizeKind(row.kind)
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
    kinds: normalizeKindsArray(row.kinds, kind),
    slotLabel: asNullableString(row.slotLabel ?? row.slot_label),
    roomName: asNullableString(row.roomName ?? row.room_name),
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

export type BulkValidateAction = "approve" | "reject"

export type BulkValidateItem = {
  attendanceId: string
  validatedHours?: number
}

export type BulkValidateResult = {
  success: number
  failed: number
  errors: Array<{ attendanceId: string; error: string }>
}

export const bulkValidate = async (input: {
  action: BulkValidateAction
  items: BulkValidateItem[]
  reason?: string
}): Promise<BulkValidateResult> => {
  const response = await api.post<unknown>("/validations/bulk", {
    action: input.action,
    items: input.items.map((i) => ({
      attendance_id: i.attendanceId,
      ...(i.validatedHours !== undefined ? { validated_hours: i.validatedHours } : {}),
    })),
    ...(input.reason ? { reason: input.reason } : {}),
  })
  const data = isRecord(response.data) ? response.data : {}
  return {
    success: asNumber(data.success),
    failed: asNumber(data.failed),
    errors: Array.isArray(data.errors)
      ? (data.errors as Array<{ attendanceId: string; error: string }>)
      : [],
  }
}

export const getPendingValidationCount = async (): Promise<PendingValidationCount> => {
  const response = await api.get<unknown>("/validations/pending/count")
  const payload = isRecord(response.data) ? response.data : {}
  return {
    gps_suspicious: asNumber(payload.gps_suspicious),
    short_hours: asNumber(payload.short_hours),
    missing_end_scan: asNumber(payload.missing_end_scan),
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

// ── Missing end-scan types & API ────────────────────────────────────────────

export type EndScanAction = "warned" | "sanctioned"

export type MissingEndScanSession = {
  date: string
  scheduleId: string
  attendanceId: string
  subject: string
  timeSlot: string
  roomName: string | null
  startScanAt: string | null
  endScanAction: EndScanAction | null
  endScanActionReason: string | null
  endScanActionAt: string | null
  endScanActionCancelledAt: string | null
  scheduleDurationMinutes: number
  /**
   * Durée estimée du cours en minutes (end_time prévu − checked_in_at).
   * Borne supérieure d'aide à la décision ; ne crédite rien au salaire.
   */
  estimatedDurationMinutes: number | null
  /** True si l'estimation suggère un cours court vs la durée prévue. */
  likelyShortHours: boolean
}

export type MissingEndScanTeacher = {
  teacherId: string
  teacherName: string
  hourlyRate: number | null
  missingEndScanCount: number
  warningCount: number
  sanctionCount: number
  sessions: MissingEndScanSession[]
}

const normalizeEndScanAction = (value: unknown): EndScanAction | null => {
  if (value === "warned" || value === "sanctioned") return value
  return null
}

const normalizeMissingEndScanTeacher = (value: unknown): MissingEndScanTeacher => {
  const row = isRecord(value) ? value : {}
  const sessions = Array.isArray(row.sessions)
    ? row.sessions.map((s: unknown) => {
        const session = isRecord(s) ? s : {}
        return {
          date: asString(session.date),
          scheduleId: asString(session.scheduleId ?? session.schedule_id),
          attendanceId: asString(session.attendanceId ?? session.attendance_id),
          subject: asString(session.subject, "--"),
          timeSlot: asString(session.timeSlot ?? session.time_slot, "--"),
          roomName: asNullableString(session.roomName ?? session.room_name),
          startScanAt: asNullableString(session.startScanAt ?? session.start_scan_at ?? session.room_scan_start_at),
          endScanAction: normalizeEndScanAction(session.endScanAction ?? session.end_scan_action),
          endScanActionReason: asNullableString(session.endScanActionReason ?? session.end_scan_action_reason),
          endScanActionAt: asNullableString(session.endScanActionAt ?? session.end_scan_action_at),
          endScanActionCancelledAt: asNullableString(session.endScanActionCancelledAt ?? session.end_scan_action_cancelled_at),
          scheduleDurationMinutes: asNumber(session.scheduleDurationMinutes ?? session.schedule_duration_minutes),
          estimatedDurationMinutes: asNullableNumber(
            session.estimatedDurationMinutes ?? session.estimated_duration_minutes
          ),
          likelyShortHours:
            session.likelyShortHours === true || session.likely_short_hours === true,
        }
      })
    : []
  return {
    teacherId: asString(row.teacherId ?? row.teacher_id),
    teacherName: asString(row.teacherName ?? row.teacher_name, "Enseignant"),
    hourlyRate: asNullableNumber(row.hourlyRate ?? row.hourly_rate),
    missingEndScanCount: asNumber(row.missingEndScanCount ?? row.missing_end_scan_count),
    warningCount: asNumber(row.warningCount ?? row.warning_count),
    sanctionCount: asNumber(row.sanctionCount ?? row.sanction_count),
    sessions,
  }
}

export const fetchMissingEndScans = async (month: string): Promise<MissingEndScanTeacher[]> => {
  const response = await api.get<unknown>("/validations/missing-end-scans", { params: { month } })
  const payload = response.data
  return Array.isArray(payload) ? payload.map(normalizeMissingEndScanTeacher) : []
}

export const bulkWarnEndScans = async (
  teacherIds: string[],
  month: string
): Promise<{ teacherCount: number; warnedCount: number }> => {
  const response = await api.post<unknown>("/validations/bulk-warn-end-scans", {
    teacher_ids: teacherIds,
    month,
  })
  const data = isRecord(response.data) ? response.data : {}
  return {
    teacherCount: asNumber(data.teacherCount ?? data.teacher_count),
    warnedCount: asNumber(data.warnedCount ?? data.warned_count),
  }
}

export const invalidateSession = async (attendanceId: string, reason: string): Promise<void> => {
  await api.patch("/validations/invalidate-session", {
    attendance_id: attendanceId,
    reason,
  })
}

export const applyEndScanAction = async (input: {
  attendanceId: string
  action: EndScanAction
  reason: string
  /** Heures à créditer pour action='warned' (optionnel). */
  validatedHours?: number
}): Promise<void> => {
  await api.post("/validations/end-scan-action", {
    attendance_id: input.attendanceId,
    action: input.action,
    reason: input.reason,
    ...(input.validatedHours !== undefined ? { validated_hours: input.validatedHours } : {}),
  })
}

export const cancelEndScanSanction = async (input: {
  attendanceId: string
  reason: string
}): Promise<void> => {
  await api.post("/validations/cancel-end-scan-sanction", {
    attendance_id: input.attendanceId,
    reason: input.reason,
  })
}

// ── Validation history ───────────────────────────────────────────────────────

export type ValidationHistoryStatus = "approved" | "rejected"

export type ValidationHistoryItem = {
  attendanceId: string
  teacherId: string
  teacherName: string
  courseName: string
  className: string
  date: string
  validationStatus: ValidationHistoryStatus
  validatedHours: number | null
  validationReason: string | null
  validatedAt: string | null
  kind: ValidationKind
  kinds: ValidationKind[]
  slotLabel: string | null
  roomName: string | null
  scheduleDurationMinutes: number
  actualMinutes: number | null
  hourlyRate: number | null
}

export type ValidationHistoryPage = {
  items: ValidationHistoryItem[]
  total: number
  page: number
  limit: number
}

const normalizeHistoryItem = (value: unknown): ValidationHistoryItem => {
  const row = isRecord(value) ? value : {}
  const status = row.validationStatus === "approved" || row.validationStatus === "rejected"
    ? row.validationStatus
    : row.validation_status === "approved" || row.validation_status === "rejected"
      ? row.validation_status
      : "rejected"
  const kind = normalizeKind(row.kind)
  return {
    attendanceId: asString(row.attendanceId ?? row.attendance_id),
    teacherId: asString(row.teacherId ?? row.teacher_id),
    teacherName: asString(row.teacherName ?? row.teacher_name, "Enseignant"),
    courseName: asString(row.courseName ?? row.course_name, "Cours"),
    className: asString(row.className ?? row.class_name, "Classe"),
    date: asString(row.date),
    validationStatus: status as ValidationHistoryStatus,
    validatedHours: asNullableNumber(row.validatedHours ?? row.validated_hours),
    validationReason: asNullableString(row.validationReason ?? row.validation_reason),
    validatedAt: asNullableString(row.validatedAt ?? row.validated_at),
    kind,
    kinds: normalizeKindsArray(row.kinds, kind),
    slotLabel: asNullableString(row.slotLabel ?? row.slot_label),
    roomName: asNullableString(row.roomName ?? row.room_name),
    scheduleDurationMinutes: asNumber(row.scheduleDurationMinutes ?? row.schedule_duration_minutes),
    actualMinutes: asNullableNumber(row.actualMinutes ?? row.actual_minutes),
    hourlyRate: asNullableNumber(row.hourlyRate ?? row.hourly_rate),
  }
}

export type ValidationApprovalType = "planned" | "actual"

export const fetchValidationHistory = async (params: {
  kind?: ValidationKind
  month?: string
  status?: ValidationHistoryStatus
  approvalType?: ValidationApprovalType
  search?: string
  page?: number
  limit?: number
}): Promise<ValidationHistoryPage> => {
  const query: Record<string, string | number> = {}
  if (params.kind) query.kind = params.kind
  if (params.month) query.month = params.month
  if (params.status) query.status = params.status
  if (params.approvalType) query.approvalType = params.approvalType
  if (params.search) query.search = params.search
  if (params.page) query.page = params.page
  if (params.limit) query.limit = params.limit

  const response = await api.get<unknown>("/validations/history", { params: query })
  const payload = isRecord(response.data) ? response.data : {}
  return {
    items: Array.isArray(payload.items) ? payload.items.map(normalizeHistoryItem) : [],
    total: asNumber(payload.total),
    page: asNumber(payload.page, 1),
    limit: asNumber(payload.limit, 20),
  }
}

// ── Teacher in-app notifications ────────────────────────────────────────────

export type TeacherNotificationItem = {
  id: string
  type: string
  message: string
  createdAt: string
  readAt: string | null
  metadata: Record<string, unknown> | null
}

const normalizeTeacherNotification = (value: unknown): TeacherNotificationItem => {
  const row = isRecord(value) ? value : {}
  const metadata = isRecord(row.metadata) ? (row.metadata as Record<string, unknown>) : null
  return {
    id: asString(row.id),
    type: asString(row.type),
    message: asString(row.message),
    createdAt: asString(row.createdAt ?? row.created_at),
    readAt: asNullableString(row.readAt ?? row.read_at ?? metadata?.read_at),
    metadata,
  }
}

export const fetchTeacherNotifications = async (): Promise<TeacherNotificationItem[]> => {
  const response = await api.get<unknown>("/teacher/notifications")
  const payload = response.data
  return Array.isArray(payload) ? payload.map(normalizeTeacherNotification) : []
}

export const markTeacherNotificationRead = async (notificationId: string): Promise<void> => {
  await api.patch(`/teacher/notifications/${notificationId}/read`)
}

export const markAllTeacherNotificationsRead = async (): Promise<void> => {
  await api.patch("/teacher/notifications/read-all")
}
