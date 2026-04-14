import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
})

type AttendanceStatus = "present" | "absent" | "late" | "excused" | null

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null

const asNumber = (value: unknown, fallback = 0): number => {
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

const asString = (value: unknown, fallback = ""): string => {
  return typeof value === "string" ? value : fallback
}

const asNullableString = (value: unknown): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null
}

const asBoolean = (value: unknown): boolean => value === true

const resolvePayload = (payload: unknown): unknown => {
  if (!isRecord(payload)) {
    return payload
  }

  if ("data" in payload) {
    return payload.data
  }

  return payload
}

const firstNonEmptyArray = <T>(...values: unknown[]): T[] => {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return value as T[]
    }
  }

  return []
}

const toStatus = (value: unknown): AttendanceStatus => {
  if (value === "present" || value === "absent" || value === "late" || value === "excused") {
    return value
  }

  return null
}

export type DashboardCourseItem = {
  id: string
  subject: string
  className: string
  roomName: string
  slotLabel: string
  startTime: string
  endTime: string
  status: AttendanceStatus
  lateMinutes: number | null
  roomMismatch: boolean
  roomScannedName: string | null
  checkedInAt: string | null
}

export type DashboardTodayData = {
  date: string
  presentCount: number
  absentCount: number
  unmarkedCount: number
  courses: DashboardCourseItem[]
}

export type DashboardHistoryPoint = {
  date: string
  presentCount: number
  totalCount: number
  attendanceRate: number
}

export type DashboardSmsItem = {
  id: string
  type: string
  recipientPhone: string
  message: string
  status: "queued" | "sent" | "failed" | "delivered" | "unknown"
  sentAt: string | null
  createdAt: string | null
}

export type DashboardQRAlertType =
  | "teacher_qr_mismatch"
  | "teacher_qr_missing_scan"
  | "teacher_qr_scan_out_of_time"

export type DashboardQRAlertItem = {
  id: string
  type: DashboardQRAlertType
  status: DashboardSmsItem["status"]
  message: string
  dateTime: string | null
  teacherName: string
  subject: string
  className: string | null
  expectedRoom: string | null
  scannedRoom: string | null
  slotLabel: string | null
  isToday: boolean
}

const QR_ALERT_TYPES: DashboardQRAlertType[] = [
  "teacher_qr_mismatch",
  "teacher_qr_missing_scan",
  "teacher_qr_scan_out_of_time",
]

const QR_ALERT_TYPES_PARAM = QR_ALERT_TYPES.join(",")

const isQrAlertType = (value: unknown): value is DashboardQRAlertType => {
  return typeof value === "string" && QR_ALERT_TYPES.includes(value as DashboardQRAlertType)
}

const isQrAlertSmsItem = (
  item: DashboardSmsItem
): item is DashboardSmsItem & { type: DashboardQRAlertType } => isQrAlertType(item.type)

const splitSubjectAndSlot = (value: string): { subject: string; slotLabel: string | null } => {
  const trimmed = value.trim()
  const lastSpaceIndex = trimmed.lastIndexOf(" ")

  if (lastSpaceIndex <= 0) {
    return { subject: trimmed, slotLabel: null }
  }

  return {
    subject: trimmed.slice(0, lastSpaceIndex).trim(),
    slotLabel: trimmed.slice(lastSpaceIndex + 1).trim(),
  }
}

const parseQrAlertMessage = (
  type: DashboardQRAlertType,
  message: string
): {
  teacherName: string
  subject: string
  className: string | null
  expectedRoom: string | null
  scannedRoom: string | null
  slotLabel: string | null
} => {
  if (!message) {
    return {
      teacherName: "N/A",
      subject: "N/A",
      className: null,
      expectedRoom: null,
      scannedRoom: null,
      slotLabel: null,
    }
  }

  if (type === "teacher_qr_mismatch") {
    const match = message.match(
      /^EduTrack:\s*(.+?)\s+a scann[ée] salle\s+(.+?)\s+au lieu de\s+(.+?)\s+-\s+(.+)$/i
    )

    if (match) {
      const details = splitSubjectAndSlot(match[4] ?? "")
      return {
        teacherName: match[1]?.trim() || "N/A",
        scannedRoom: match[2]?.trim() || null,
        expectedRoom: match[3]?.trim() || null,
        subject: details.subject || "N/A",
        slotLabel: details.slotLabel,
        className: null,
      }
    }
  }

  if (type === "teacher_qr_missing_scan") {
    const match = message.match(
      /^EduTrack:\s*(.+?)\s+n'a pas scann[ée] le QR de sa salle\s+-\s+(.+)$/i
    )

    if (match) {
      const details = match[2]?.trim() ?? ""
      const classMatch = details.match(/^(.*)\((.*)\)\s+([^\s]+)$/)

      if (classMatch) {
        return {
          teacherName: match[1]?.trim() || "N/A",
          subject: classMatch[1]?.trim() || "N/A",
          className: classMatch[2]?.trim() || null,
          slotLabel: classMatch[3]?.trim() || null,
          expectedRoom: null,
          scannedRoom: null,
        }
      }

      const fallback = splitSubjectAndSlot(details)
      return {
        teacherName: match[1]?.trim() || "N/A",
        subject: fallback.subject || "N/A",
        className: null,
        slotLabel: fallback.slotLabel,
        expectedRoom: null,
        scannedRoom: null,
      }
    }
  }

  const outOfTimeMatch = message.match(
    /^EduTrack:\s*Scan QR hors horaire par\s+(.+?)\s+-\s+(.+)$/i
  )
  if (outOfTimeMatch) {
    const details = outOfTimeMatch[2]?.trim() ?? ""
    const detailedMatch = details.match(/^(.*)\s(\d{4}-\d{2}-\d{2})\s([^\s]+)$/)
    if (detailedMatch) {
      return {
        teacherName: outOfTimeMatch[1]?.trim() || "N/A",
        subject: detailedMatch[1]?.trim() || "N/A",
        className: null,
        slotLabel: detailedMatch[3]?.trim() || null,
        expectedRoom: null,
        scannedRoom: null,
      }
    }

    const fallback = splitSubjectAndSlot(details)
    return {
      teacherName: outOfTimeMatch[1]?.trim() || "N/A",
      subject: fallback.subject || "N/A",
      className: null,
      slotLabel: fallback.slotLabel,
      expectedRoom: null,
      scannedRoom: null,
    }
  }

  return {
    teacherName: "N/A",
    subject: "N/A",
    className: null,
    expectedRoom: null,
    scannedRoom: null,
    slotLabel: null,
  }
}

const isSameLocalDate = (isoDateTime: string | null): boolean => {
  if (!isoDateTime) {
    return false
  }

  const date = new Date(isoDateTime)
  if (Number.isNaN(date.getTime())) {
    return false
  }

  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

const normalizeCourse = (item: unknown, index: number): DashboardCourseItem => {
  const row = isRecord(item) ? item : {}
  const attendance = isRecord(row.attendance) ? row.attendance : row
  const slot = isRecord(row.timeSlot) ? row.timeSlot : row
  const klass = isRecord(row.class) ? row.class : row
  const room = isRecord(row.room) ? row.room : row

  const id =
    asString(row.id) ||
    asString(row.scheduleId) ||
    asString(row.schedule_id) ||
    `course-${index}`

  return {
    id,
    subject: asString(row.subject, "Cours"),
    className:
      asString(klass.name) || asString(row.className) || asString(row.class_name, "Classe"),
    roomName: asString(room.name) || asString(row.roomName) || asString(row.room_name, "Salle"),
    slotLabel: asString(slot.label) || asString(row.slotLabel, "Créneau"),
    startTime:
      asString(slot.startTime) ||
      asString(slot.start_time) ||
      asString(row.start_at) ||
      asString(row.start_time),
    endTime:
      asString(slot.endTime) ||
      asString(slot.end_time) ||
      asString(row.end_at) ||
      asString(row.end_time),
    status: toStatus(attendance.status ?? attendance.attendance_status),
    lateMinutes:
      attendance.lateMinutes === null || attendance.late_minutes === null
        ? null
        : asNumber(attendance.lateMinutes ?? attendance.late_minutes ?? attendance.attendance_late_minutes, 0),
    roomMismatch: asBoolean(attendance.roomMismatch ?? attendance.room_mismatch),
    roomScannedName: asNullableString(attendance.roomScannedName ?? attendance.room_scanned_name),
    checkedInAt: asNullableString(attendance.checkedInAt ?? attendance.checked_in_at ?? attendance.attendance_checked_in_at),
  }
}

const calculateTodayStats = (courses: DashboardCourseItem[]) => {
  let presentCount = 0
  let absentCount = 0
  let unmarkedCount = 0

  for (const course of courses) {
    if (course.status === "present" || course.status === "late" || course.status === "excused") {
      presentCount += 1
      continue
    }

    if (course.status === "absent") {
      absentCount += 1
      continue
    }

    unmarkedCount += 1
  }

  return { presentCount, absentCount, unmarkedCount }
}

const normalizeTodayData = (payload: unknown): DashboardTodayData => {
  const resolved = resolvePayload(payload)
  const data = isRecord(resolved) ? resolved : {}

  const coursesSource = firstNonEmptyArray<unknown>(data.courses, data.items, data.schedules)

  const courses = coursesSource.map((item, index) =>
    normalizeCourse(item, index)
  )

  const inferredStats = calculateTodayStats(courses)

  return {
    date: asString(data.date, new Date().toISOString().slice(0, 10)),
    presentCount: asNumber(data.present_count ?? data.presentCount, inferredStats.presentCount),
    absentCount: asNumber(data.absent_count ?? data.absentCount, inferredStats.absentCount),
    unmarkedCount: asNumber(data.unmarked_count ?? data.unmarkedCount, inferredStats.unmarkedCount),
    courses,
  }
}

const normalizeHistoryPoint = (item: unknown, index: number): DashboardHistoryPoint => {
  const row = isRecord(item) ? item : {}
  const date = asString(row.date, `jour-${index + 1}`)

  const totalCount = asNumber(row.total_count ?? row.totalCount ?? row.total, 0)
  const presentCount = asNumber(
    row.present_count ?? row.presentCount ?? row.present ?? row.attended,
    0
  )

  let attendanceRate = asNumber(row.attendance_rate ?? row.attendanceRate ?? row.rate, NaN)
  if (!Number.isFinite(attendanceRate)) {
    attendanceRate = totalCount > 0 ? (presentCount / totalCount) * 100 : 0
  }

  return {
    date,
    presentCount,
    totalCount,
    attendanceRate,
  }
}

const normalizeHistory = (payload: unknown): DashboardHistoryPoint[] => {
  const resolved = resolvePayload(payload)

  if (Array.isArray(resolved)) {
    return resolved.map((item, index) => normalizeHistoryPoint(item, index))
  }

  const data = isRecord(resolved) ? resolved : {}
  const rows = firstNonEmptyArray<unknown>(data.history, data.items, data.data)

  return rows.map((item, index) => normalizeHistoryPoint(item, index))
}

const normalizeSmsStatus = (
  value: unknown
): DashboardSmsItem["status"] => {
  if (value === "queued" || value === "sent" || value === "failed" || value === "delivered") {
    return value
  }

  return "unknown"
}

const normalizeSmsItem = (item: unknown, index: number): DashboardSmsItem => {
  const row = isRecord(item) ? item : {}

  return {
    id: asString(row.id) || asString(row.provider_ref) || `sms-${index}`,
    type: asString(row.type, "notification"),
    recipientPhone: asString(row.recipient_phone ?? row.recipientPhone, "-"),
    message: asString(row.message),
    status: normalizeSmsStatus(row.status),
    sentAt: asNullableString(row.sent_at ?? row.sentAt),
    createdAt: asNullableString(row.created_at ?? row.createdAt),
  }
}

const normalizeSmsLog = (payload: unknown): DashboardSmsItem[] => {
  const resolved = resolvePayload(payload)

  if (Array.isArray(resolved)) {
    return resolved.map((item, index) => normalizeSmsItem(item, index))
  }

  const data = isRecord(resolved) ? resolved : {}
  const rows = firstNonEmptyArray<unknown>(data.notifications, data.log, data.items, data.data)

  return rows.map((item, index) => normalizeSmsItem(item, index))
}

export const getTodayAttendance = async (): Promise<DashboardTodayData> => {
  try {
    const response = await api.get("/attendance/today")
    return normalizeTodayData(response.data)
  } catch {
    const fallback = await api.get("/attendance/active")
    return normalizeTodayData(fallback.data)
  }
}

export const getAttendanceHistory = async (days = 7): Promise<DashboardHistoryPoint[]> => {
  const response = await api.get("/attendance/history", { params: { days } })
  return normalizeHistory(response.data)
}

export const getSMSLog = async (limit = 10): Promise<DashboardSmsItem[]> => {
  const response = await api.get("/notifications/log", { params: { limit } })
  return normalizeSmsLog(response.data)
}

export const getQRAlerts = async (limit = 20): Promise<DashboardQRAlertItem[]> => {
  const response = await api.get("/notifications/log", {
    params: {
      types: QR_ALERT_TYPES_PARAM,
      limit,
    },
  })

  const normalized = normalizeSmsLog(response.data)
  const qrAlerts = normalized.filter(isQrAlertSmsItem)

  return qrAlerts
    .map((item) => {
      const parsed = parseQrAlertMessage(item.type, item.message)
      const dateTime = item.sentAt ?? item.createdAt

      return {
        id: item.id,
        type: item.type,
        status: item.status,
        message: item.message,
        dateTime,
        teacherName: parsed.teacherName,
        subject: parsed.subject,
        className: parsed.className,
        expectedRoom: parsed.expectedRoom,
        scannedRoom: parsed.scannedRoom,
        slotLabel: parsed.slotLabel,
        isToday: isSameLocalDate(dateTime),
      } satisfies DashboardQRAlertItem
    })
    .sort((a, b) => {
      const aDate = a.dateTime ? new Date(a.dateTime).getTime() : 0
      const bDate = b.dateTime ? new Date(b.dateTime).getTime() : 0
      return bDate - aDate
    })
}
