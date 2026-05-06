import { apiClient as api } from "@/shared/api/client"
import axios from "axios"

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

const toMonthStart = (month: string): string => `${month}-01`

export const getCurrentMonthKey = (date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export const getPreviousMonthKey = (date = new Date()): string => {
  const previous = new Date(Date.UTC(date.getFullYear(), date.getMonth() - 1, 1))
  return getCurrentMonthKey(previous)
}

const startOfWeekMonday = (date: Date): Date => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

const toDateOnly = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
}

const hasDateOverlap = (startA: Date, endA: Date, startB: Date, endB: Date): boolean => {
  return startA <= endB && startB <= endA
}

export type DashboardCourseItem = {
  id: string
  teacherName: string
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
  roomScannedAt: string | null
  roomScanEndAt: string | null
  checkedInAt: string | null
  studentRollcallDone: boolean
  studentPresentCount: number
  studentAbsentCount: number
  studentTotalCount: number
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
  absentCount: number
  totalCount: number
  attendanceRate: number
}

export type DashboardCounts = {
  activeTeachers: number
  activeStudents: number
}

export type DashboardSalaryStatus = "pending" | "paid" | "disputed" | "nothing_to_pay" | "Salaire fixe"

export type DashboardSalarySummaryItem = {
  teacherId: string
  teacherName: string
  teacherType: "vacataire" | "permanent"
  hoursPlanned: number
  hoursDone: number
  hourlyRate: number | null
  totalFcfa: number | null
  status: DashboardSalaryStatus
  salaryRecordId: string | null
  isPartiallyPaid: boolean
}

export type DashboardSalarySummary = {
  month: string
  items: DashboardSalarySummaryItem[]
}

export type DashboardRiskTeacher = {
  teacherId: string
  teacherName: string
  absenceCount: number
  attendanceRate: number
}

export type NextWeekCoverageState = {
  nextWeekHasCoverage: boolean
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

type TeacherSalaryDetailRow = {
  date: string
  attendanceStatus: "present" | "absent" | "late" | "excused" | "not_marked"
}

type TeacherSalaryDetailResponse = {
  rows: TeacherSalaryDetailRow[]
}

const QR_ALERT_TYPES: DashboardQRAlertType[] = [
  "teacher_qr_mismatch",
  "teacher_qr_missing_scan",
  "teacher_qr_scan_out_of_time",
]

const QR_ALERT_TYPES_PARAM = QR_ALERT_TYPES.join(",")

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

const isQrAlertType = (value: unknown): value is DashboardQRAlertType => {
  return typeof value === "string" && QR_ALERT_TYPES.includes(value as DashboardQRAlertType)
}

const isQrAlertSmsItem = (
  item: DashboardSmsItem
): item is DashboardSmsItem & { type: DashboardQRAlertType } => isQrAlertType(item.type)

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
  const teacherMatch = message.match(/:\s*(.+?)\s+(a|n'a pas|Scan)/i)
  const teacherName = teacherMatch?.[1]?.trim() || "N/A"

  const base = {
    teacherName,
    subject: "N/A",
    className: null,
    expectedRoom: null,
    scannedRoom: null,
    slotLabel: null,
  }

  if (type === "teacher_qr_mismatch") {
    const match = message.match(/scann[ée]\s+salle\s+(.+?)\s+au lieu de\s+(.+?)\s+-\s+(.+)$/i)
    if (!match) {
      return base
    }

    const details = match[3]?.trim() ?? ""
    const slotMatch = details.match(/^(.*)\s+(\d{2}:\d{2}-\d{2}:\d{2})$/)

    return {
      ...base,
      scannedRoom: match[1]?.trim() || null,
      expectedRoom: match[2]?.trim() || null,
      subject: (slotMatch?.[1] ?? details).trim() || "N/A",
      slotLabel: slotMatch?.[2] ?? null,
    }
  }

  if (type === "teacher_qr_missing_scan") {
    const match = message.match(/QR de sa salle\s+-\s+(.+)$/i)
    if (!match) {
      return base
    }

    return {
      ...base,
      subject: match[1]?.trim() || "N/A",
    }
  }

  const match = message.match(/hors horaire.+-\s+(.+)$/i)
  if (!match) {
    return base
  }

  return {
    ...base,
    subject: match[1]?.trim() || "N/A",
  }
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
    teacherName:
      asString(row.teacher_name) || asString(row.teacherName) || asString(row.teacher) || "Professeur",
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
    roomScannedAt: asNullableString(attendance.roomScannedAt ?? attendance.room_scanned_at),
    roomScanEndAt: asNullableString(attendance.roomScanEndAt ?? attendance.room_scan_end_at),
    checkedInAt: asNullableString(attendance.checkedInAt ?? attendance.checked_in_at ?? attendance.attendance_checked_in_at),
    studentRollcallDone: asBoolean(attendance.studentRollcallDone ?? attendance.student_rollcall_done),
    studentPresentCount: asNumber(attendance.studentPresentCount ?? attendance.student_present_count, 0),
    studentAbsentCount: asNumber(attendance.studentAbsentCount ?? attendance.student_absent_count, 0),
    studentTotalCount: asNumber(attendance.studentTotalCount ?? attendance.student_total_count, 0),
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
  const absentCount = asNumber(row.absent_count ?? row.absentCount ?? row.absent, Math.max(0, totalCount - presentCount))

  let attendanceRate = asNumber(row.attendance_rate ?? row.attendanceRate ?? row.rate, Number.NaN)
  if (!Number.isFinite(attendanceRate)) {
    attendanceRate = totalCount > 0 ? (presentCount / totalCount) * 100 : 0
  }

  return {
    date,
    presentCount,
    absentCount,
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

const normalizeTeachersTotal = (payload: unknown): number => {
  const data = isRecord(payload) ? payload : {}
  const pagination = isRecord(data.pagination) ? data.pagination : {}
  return asNumber(pagination.total, 0)
}

const normalizeStudentsTotal = (payload: unknown): number => {
  const data = isRecord(payload) ? payload : {}
  const pagination = isRecord(data.pagination) ? data.pagination : {}
  return asNumber(pagination.total, 0)
}

const normalizeSalaryItem = (item: unknown): DashboardSalarySummaryItem => {
  const row = isRecord(item) ? item : {}

  const statusRaw = asString(row.status ?? row.salary_status)
  const parsedStatus: DashboardSalaryStatus =
    statusRaw === "paid" ||
    statusRaw === "pending" ||
    statusRaw === "disputed" ||
    statusRaw === "nothing_to_pay" ||
    statusRaw === "Salaire fixe"
      ? statusRaw
      : "pending"

  const teacherTypeRaw = asString(row.teacherType ?? row.teacher_type)
  const teacherType = teacherTypeRaw === "permanent" ? "permanent" : "vacataire"

  return {
    teacherId: asString(row.teacherId ?? row.teacher_id),
    teacherName: asString(row.teacherName ?? row.teacher_name, "Professeur"),
    teacherType,
    hoursPlanned: asNumber(row.hoursPlanned ?? row.hours_planned, 0),
    hoursDone: asNumber(row.hoursDone ?? row.hours_done, 0),
    hourlyRate: row.hourlyRate === null || row.hourly_rate === null ? null : asNumber(row.hourlyRate ?? row.hourly_rate, 0),
    totalFcfa: row.totalFcfa === null || row.total_fcfa === null ? null : asNumber(row.totalFcfa ?? row.total_fcfa, 0),
    status: parsedStatus,
    salaryRecordId: asNullableString(row.salaryRecordId ?? row.salary_record_id),
    isPartiallyPaid: Boolean(row.isPartiallyPaid ?? row.is_partially_paid),
  }
}

const normalizeSalarySummary = (payload: unknown, month: string): DashboardSalarySummary => {
  const resolved = resolvePayload(payload)
  const data = isRecord(resolved) ? resolved : {}
  const itemsRaw = firstNonEmptyArray<unknown>(data.items, data.rows, data.data)

  return {
    month: asString(data.month, month),
    items: itemsRaw.map((item) => normalizeSalaryItem(item)),
  }
}

const normalizeTeacherSalaryDetails = (payload: unknown): TeacherSalaryDetailResponse => {
  const data = isRecord(payload) ? payload : {}
  const rowsRaw = Array.isArray(data.rows) ? data.rows : []

  const rows: TeacherSalaryDetailRow[] = rowsRaw.map((entry) => {
    const row = isRecord(entry) ? entry : {}
    const status = asString(row.attendanceStatus)

    return {
      date: asString(row.date),
      attendanceStatus:
        status === "present" ||
        status === "absent" ||
        status === "late" ||
        status === "excused" ||
        status === "not_marked"
          ? status
          : "not_marked",
    }
  })

  return { rows }
}

export const getTodayAttendance = async (): Promise<DashboardTodayData> => {
  try {
    const response = await api.get("/attendance/today")
    return normalizeTodayData(response.data)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      if (status !== 401 && status !== 403 && status !== 404) {
        throw error
      }
    }

    const fallback = await api.get("/attendance/active")
    return normalizeTodayData(fallback.data)
  }
}

export const getAttendanceHistory = async (days = 7): Promise<DashboardHistoryPoint[]> => {
  const response = await api.get("/attendance/history", { params: { days } })
  return normalizeHistory(response.data)
}

export const getDashboardCounts = async (): Promise<DashboardCounts> => {
  const [teachersResponse, studentsResponse] = await Promise.all([
    api.get("/teachers", {
      params: {
        page: 1,
        limit: 1,
        is_active: true,
      },
    }),
    api.get("/students", {
      params: {
        page: 1,
        limit: 1,
        is_active: true,
      },
    }),
  ])

  return {
    activeTeachers: normalizeTeachersTotal(teachersResponse.data),
    activeStudents: normalizeStudentsTotal(studentsResponse.data),
  }
}

export const getSalarySummary = async (month: string): Promise<DashboardSalarySummary> => {
  const response = await api.get("/billing/salary/summary", {
    params: { month },
  })

  return normalizeSalarySummary(response.data, month)
}

const getTeacherSalaryDetails = async (
  teacherId: string,
  month: string
): Promise<TeacherSalaryDetailResponse> => {
  const response = await api.get(`/billing/salary/${teacherId}`, {
    params: { month },
  })

  return normalizeTeacherSalaryDetails(response.data)
}

export const getTopRiskTeachers = async (month: string): Promise<DashboardRiskTeacher[]> => {
  const salarySummary = await getSalarySummary(month)
  const teacherRows = salarySummary.items.filter((item) => item.teacherId)

  const details = await Promise.all(
    teacherRows.map(async (teacher) => {
      const payload = await getTeacherSalaryDetails(teacher.teacherId, month)
      const now = new Date()
      const effectiveRows = payload.rows.filter((row) => {
        const [year, monthRaw, day] = row.date.split("-").map((part: string) => Number(part))
        const rowDate = new Date(year ?? 1970, (monthRaw ?? 1) - 1, day ?? 1)
        return rowDate.getTime() <= now.getTime()
      })

      const totalRows = effectiveRows.length
      const absenceCount = effectiveRows.filter((row) => row.attendanceStatus === "absent").length
      const presentLikeCount = effectiveRows.filter(
        (row) => row.attendanceStatus === "present" || row.attendanceStatus === "late" || row.attendanceStatus === "excused"
      ).length

      const attendanceRate = totalRows > 0 ? (presentLikeCount / totalRows) * 100 : 0

      return {
        teacherId: teacher.teacherId,
        teacherName: teacher.teacherName,
        absenceCount,
        attendanceRate,
      } satisfies DashboardRiskTeacher
    })
  )

  return details
    .sort((a, b) => {
      if (b.absenceCount !== a.absenceCount) {
        return b.absenceCount - a.absenceCount
      }

      return a.attendanceRate - b.attendanceRate
    })
    .slice(0, 5)
}

export const getNextWeekCoverageState = async (): Promise<NextWeekCoverageState> => {
  const response = await api.get("/schedule/periods")
  const payload = isRecord(response.data) ? response.data : {}
  const periodsRaw = Array.isArray(payload.periods) ? payload.periods : []

  const now = new Date()
  const nextWeekReference = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 7))
  const nextWeekStart = startOfWeekMonday(nextWeekReference)
  const nextWeekEnd = new Date(nextWeekStart)
  nextWeekEnd.setUTCDate(nextWeekEnd.getUTCDate() + 6)

  const hasCoverage = periodsRaw.some((period) => {
    const row = isRecord(period) ? period : {}
    if (!asBoolean(row.is_active)) {
      return false
    }

    const validFrom = asString(row.valid_from)
    const validTo = asString(row.valid_to)

    if (!validFrom || !validTo) {
      return false
    }

    return hasDateOverlap(toDateOnly(validFrom), toDateOnly(validTo), nextWeekStart, nextWeekEnd)
  })

  return {
    nextWeekHasCoverage: hasCoverage,
  }
}

export const getTotalPendingSalaries = (salarySummary: DashboardSalarySummary): { totalFcfa: number; count: number } => {
  return salarySummary.items.reduce(
    (acc, row) => {
      if (row.status !== "pending") {
        return acc
      }

      acc.count += 1
      acc.totalFcfa += row.totalFcfa ?? 0
      return acc
    },
    { totalFcfa: 0, count: 0 }
  )
}

export const getTeacherTrendFromSummaries = (
  current: DashboardSalarySummary,
  previous: DashboardSalarySummary
): number => {
  const currentCount = current.items.length
  const previousCount = previous.items.length

  if (previousCount === 0) {
    return currentCount > 0 ? 100 : 0
  }

  return ((currentCount - previousCount) / previousCount) * 100
}

export const buildCurrentMonthParam = (date = new Date()): string => toMonthStart(getCurrentMonthKey(date))

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
