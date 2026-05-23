import { apiClient as api } from "@/shared/api/client"

export type GeoPayload = { latitude?: number; longitude?: number; accuracy?: number }
export type CheckInPayload = { schedule_id: string; date?: string } & GeoPayload
export type CheckInResponse = { late_minutes?: number | null; geo_status?: string | null }
export type CheckOutPayload = { schedule_id: string; date?: string } & GeoPayload
export type CheckOutResponse = { actual_minutes: number; geo_status: string }

export type QrScanPayload = {
  qr_token: string
  scan_type: "start" | "end"
  schedule_id: string
}
export type QrScanResponse = { room_mismatch?: boolean }
export type QrSkipPayload = {
  scan_type: "start" | "end"
  schedule_id: string
  date?: string
}

export type BulkStudentsPayload = {
  schedule_id: string
  date: string
  absent_student_ids: string[]
}
export type BulkStudentsResponse = { success: boolean }

export type StudentItem = { id: string; full_name: string }
export type RoomItem = { id: string; name: string; qr_token: string }
export type TeacherAttendancePolicy = {
  allow_teacher_qr_skip: boolean
  geo_check_enabled: boolean
  use_real_hours: boolean
}

export type TeacherComplianceItem = {
  teacherId: string
  teacherName: string
  totalCheckins: number
  totalCheckouts: number
  complianceRate: number
  rank: number
}

export type ScheduleSlot = {
  id: string
  class_id: string
  class_name: string
  subject_name: string
  room_id: string
  room_name: string
  day_of_week: number
  start_time: string
  end_time: string
  date?: string
}

export type TeacherAttendance = {
  id?: string
  schedule_id: string
  status: "present" | "absent" | "late"
  late_minutes?: number | null
  date?: string
  room_scan_start_at?: string | null
  room_scan_end_at?: string | null
  checked_out_at?: string | null
  actual_minutes?: number | null
  geo_status?: "verified" | "suspicious" | "unavailable" | "not_checked" | null
}

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}

const toString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

const toBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback

const toComplianceItem = (row: unknown): TeacherComplianceItem => {
  const item = toRecord(row)

  return {
    teacherId: toString(item.teacherId ?? item.teacher_id),
    teacherName: toString(item.teacherName ?? item.teacher_name),
    totalCheckins: toNumber(item.totalCheckins ?? item.total_checkins),
    totalCheckouts: toNumber(item.totalCheckouts ?? item.total_checkouts),
    complianceRate: toNumber(item.complianceRate ?? item.compliance_rate),
    rank: toNumber(item.rank),
  }
}

const toAttendanceStatus = (
  value: unknown
): "present" | "absent" | "late" => {
  if (value === "absent" || value === "late" || value === "present") {
    return value
  }
  // Donnée legacy 'excused' ou inconnu → traité comme 'present' (cf. STUDENT_ATTENDANCE_STATUS pour les élèves).
  return "present"
}

const toScheduleSlot = (row: unknown): ScheduleSlot => {
  const item = toRecord(row)
  const classRecord = toRecord(item.class)
  const roomRecord = toRecord(item.room)
  const timeSlotRecord = toRecord(item.timeSlot)

  return {
    id: toString(item.id),
    class_id: toString(item.class_id || item.classId || classRecord.id),
    class_name: toString(item.class_name || item.className || classRecord.name),
    subject_name: toString(item.subject_name || item.subjectName || item.subject),
    room_id: toString(item.room_id || item.roomId || roomRecord.id),
    room_name: toString(item.room_name || item.roomName || roomRecord.name),
    day_of_week: toNumber(item.day_of_week ?? item.dayOfWeek),
    start_time: toString(
      item.start_time ||
        item.startTime ||
        timeSlotRecord.start_time ||
        timeSlotRecord.startTime
    ),
    end_time: toString(
      item.end_time || item.endTime || timeSlotRecord.end_time || timeSlotRecord.endTime
    ),
  }
}

const toTeacherAttendance = (row: unknown): TeacherAttendance => {
  const item = toRecord(row)

  return {
    id: toString(item.id),
    schedule_id: toString(item.schedule_id || item.scheduleId),
    status: toAttendanceStatus(item.status || item.attendance_status),
    late_minutes:
      typeof item.late_minutes === "number"
        ? item.late_minutes
        : typeof item.lateMinutes === "number"
          ? item.lateMinutes
          : null,
    date: toString(item.date),
    room_scan_start_at:
      typeof item.room_scan_start_at === "string"
        ? item.room_scan_start_at
        : typeof item.roomScanStartAt === "string"
          ? item.roomScanStartAt
          : null,
    room_scan_end_at:
      typeof item.room_scan_end_at === "string"
        ? item.room_scan_end_at
        : typeof item.roomScanEndAt === "string"
          ? item.roomScanEndAt
          : null,
    checked_out_at:
      typeof item.checked_out_at === "string"
        ? item.checked_out_at
        : typeof item.checkedOutAt === "string"
          ? item.checkedOutAt
          : null,
    actual_minutes:
      typeof item.actual_minutes === "number"
        ? item.actual_minutes
        : typeof item.actualMinutes === "number"
          ? item.actualMinutes
          : null,
    geo_status:
      item.geo_status === "verified" ||
      item.geo_status === "suspicious" ||
      item.geo_status === "unavailable" ||
      item.geo_status === "not_checked"
        ? item.geo_status
        : null,
  }
}

const toStudentItem = (row: unknown): StudentItem => {
  const item = toRecord(row)

  const firstName = toString(item.first_name || item.firstName)
  const lastName = toString(item.last_name || item.lastName)
  const fullName = toString(item.full_name || item.fullName).trim()

  return {
    id: toString(item.id),
    full_name: fullName || `${firstName} ${lastName}`.trim(),
  }
}

const extractList = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload
  const rec = toRecord(payload)
  if (Array.isArray(rec.data)) return rec.data as unknown[]
  if (Array.isArray(rec.schedules)) return rec.schedules as unknown[]
  return []
}

export const teacherScheduleApi = {
  getMySchedule: async () => {
    const response = await api.get<unknown>("/schedule/teacher/me")
    return extractList(response.data).map(toScheduleSlot)
  },

  /**
   * Retourne TOUS les créneaux de la période active qui couvre `date`
   * (tous les day_of_week, sans filtre sur le jour de semaine).
   *
   * `date` = n'importe quel jour de la semaine affichée dans le DayPicker
   * (typiquement `selectedDateKey`). Le backend résout la période active
   * pour CETTE date → si aucune période ne couvre cette semaine, retourne [].
   *
   * Le queryKey dans TeacherSchedulePage doit inclure `date` pour que
   * React Query refetch automatiquement quand on navigue vers une autre semaine.
   */
  getMyScheduleWeek: async (date: string): Promise<ScheduleSlot[]> => {
    const response = await api.get<unknown>("/schedule/teacher/me/week", {
      params: { date },
    })
    return extractList(response.data).map(toScheduleSlot)
  },

  getMyAttendanceForDate: async (date: string) => {
    const response = await api.get<unknown>(`/attendance/teacher/me?date=${date}`)
    return extractList(response.data).map(toTeacherAttendance)
  },

  checkIn: async (body: { schedule_id: string; date: string } & GeoPayload) => {
    const response = await api.post<{
      data?: { lateMinutes?: number | null; geoStatus?: string }
      late_minutes?: number | null
    }>("/attendance/check-in", body)

    return {
      late_minutes: response.data?.data?.lateMinutes ?? response.data?.late_minutes ?? null,
      geo_status: response.data?.data?.geoStatus ?? null,
    }
  },

  checkOut: async (body: { schedule_id: string; date?: string } & GeoPayload) => {
    const response = await api.post<{
      data?: { actualMinutes?: number; geoStatus?: string }
    }>("/attendance/check-out", body)

    return {
      actual_minutes: response.data?.data?.actualMinutes ?? 0,
      geo_status: response.data?.data?.geoStatus ?? "not_checked",
    }
  },

  scanQr: async (body: {
    qr_token: string
    scan_type: "start" | "end"
    schedule_id: string
  }) => {
    const response = await api.post<{
      data?: { roomMismatch?: boolean }
      room_mismatch?: boolean
    }>("/attendance/qr-scan", body)

    return {
      room_mismatch:
        response.data?.data?.roomMismatch ?? response.data?.room_mismatch ?? false,
    }
  },

  skipQr: async (body: {
    scan_type: "start" | "end"
    schedule_id: string
    date?: string
  }) => {
    await api.post("/attendance/qr-skip", body)
    return { success: true as const }
  },

  getTeacherAttendancePolicy: async (): Promise<TeacherAttendancePolicy> => {
    const response = await api.get<unknown>("/school/info")
    const payload = toRecord(response.data)

    return {
      allow_teacher_qr_skip: toBoolean(
        payload.allow_teacher_qr_skip ?? payload.allowTeacherQrSkip,
        false
      ),
      geo_check_enabled: toBoolean(payload.geo_check_enabled ?? payload.geoCheckEnabled, false),
      use_real_hours: toBoolean(payload.use_real_hours ?? payload.useRealHours, false),
    }
  },

  getMyCompliance: async (month: string): Promise<TeacherComplianceItem | null> => {
    const response = await api.get<unknown>("/attendance/teacher-compliance", {
      params: { month },
    })
    const rows = extractList(response.data).map(toComplianceItem)
    return rows[0] ?? null
  },
  
  // Soumettre la présence d'élèves pour un créneau donné
  submitStudentAttendance: async (body: {
    schedule_id: string
    date: string
    absent_student_ids: string[]
  }) => {
    const response = await api.post<{
      data?: { upsertedCount?: number }
    }>("/attendance/students/bulk", {
      schedule_id: body.schedule_id,
      date: body.date,
      absent_student_ids: body.absent_student_ids,
    })
    return {
      upsertedCount: response.data?.data?.upsertedCount ?? 0,
    }
  },

  getStudentsByClass: async (classId: string) => {
    const response = await api.get<unknown>("/students", {
      params: { class_id: classId },
    })

    const payload = response.data
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(toRecord(payload).data)
        ? (toRecord(payload).data as unknown[])
        : []

    return list.map(toStudentItem)
  },
}

// ── Exports standalone (utilisés par TeacherFlow.tsx) ────────────────────────

export const checkIn = (payload: CheckInPayload) =>
  api
    .post<{ data?: { lateMinutes?: number | null; geoStatus?: string }; late_minutes?: number | null }>(
      "/attendance/check-in",
      payload
    )
    .then((r) => ({
      late_minutes: r.data?.data?.lateMinutes ?? r.data?.late_minutes ?? null,
      geo_status: r.data?.data?.geoStatus ?? null,
    }))

export const checkOut = (payload: CheckOutPayload) =>
  api
    .post<{ data?: { actualMinutes?: number; geoStatus?: string } }>("/attendance/check-out", payload)
    .then((r) => ({
      actual_minutes: r.data?.data?.actualMinutes ?? 0,
      geo_status: r.data?.data?.geoStatus ?? "not_checked",
    }))

export const qrScan = (payload: QrScanPayload) =>
  api
    .post<{ data?: { roomMismatch?: boolean }; room_mismatch?: boolean }>(
      "/attendance/qr-scan",
      payload
    )
    .then((r) => ({
      room_mismatch: r.data?.data?.roomMismatch ?? r.data?.room_mismatch ?? false,
    }))

export const qrSkip = (payload: QrSkipPayload) =>
  api.post("/attendance/qr-skip", payload).then(() => ({ success: true as const }))

export const bulkStudents = (payload: BulkStudentsPayload) =>
  api
    .post<{ data?: { upsertedCount?: number } }>("/attendance/students/bulk", {
      schedule_id: payload.schedule_id,
      date: payload.date,
      absent_student_ids: payload.absent_student_ids,
    })
    .then((r) => ({
      success: (r.data?.data?.upsertedCount ?? 0) >= 0,
    }))

export const fetchStudents = (classId: string) =>
  api
    .get<{
      data?: Array<{
        id: string
        firstName?: string
        lastName?: string
        first_name?: string
        last_name?: string
      }>
    }>("/students", { params: { class_id: classId } })
    .then((r) =>
      (r.data?.data ?? []).map((student) => ({
        id: student.id,
        full_name:
          `${student.firstName ?? student.first_name ?? ""} ${student.lastName ?? student.last_name ?? ""}`.trim(),
      }))
    )

export const fetchRooms = async (): Promise<RoomItem[]> => {
  const response = await api.get<unknown>("/rooms")
  const payload = toRecord(response.data)

  const list = Array.isArray(response.data)
    ? response.data
    : Array.isArray(payload.rooms)
      ? payload.rooms
      : Array.isArray(payload.data)
        ? payload.data
        : []

  return list.map((item) => {
    const row = toRecord(item)
    return {
      id: toString(row.id),
      name: toString(row.name),
      qr_token: toString(row.qr_token || row.qrToken),
    }
  })
}
