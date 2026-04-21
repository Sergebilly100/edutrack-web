import { apiClient as api } from "@/shared/api/client"

export type CheckInPayload = { schedule_id: string; date?: string }
export type CheckInResponse = { late_minutes?: number | null }

export type QrScanPayload = {
  qr_token: string
  scan_type: "start" | "end"
  schedule_id: string
}
export type QrScanResponse = { room_mismatch?: boolean }

export type BulkStudentsPayload = {
  schedule_id: string
  date: string
  absent_student_ids: string[]
}
export type BulkStudentsResponse = { success: boolean }

export type StudentItem = { id: string; full_name: string }
export type RoomItem = { id: string; name: string; qr_token: string }

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
  status: "present" | "absent" | "late" | "excused"
  late_minutes?: number | null
  date?: string
}

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}

const toString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback

const toNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" ? value : fallback

const toAttendanceStatus = (
  value: unknown
): "present" | "absent" | "late" | "excused" => {
  if (
    value === "absent" ||
    value === "late" ||
    value === "excused" ||
    value === "present"
  ) {
    return value
  }
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
    try {
      const response = await api.get<unknown>("/schedule/teacher/me/week", {
        params: { date },
      })
      return extractList(response.data).map(toScheduleSlot)
    } catch {
      // Fallback : route /week pas encore déployée → appel /me (jour courant uniquement)
      const response = await api.get<unknown>("/schedule/teacher/me")
      return extractList(response.data).map(toScheduleSlot)
    }
  },

  getMyAttendanceForDate: async (date: string) => {
    const response = await api.get<unknown>(`/attendance/teacher/me?date=${date}`)
    return extractList(response.data).map(toTeacherAttendance)
  },

  checkIn: async (body: { schedule_id: string; date: string }) => {
    const response = await api.post<{
      data?: { lateMinutes?: number | null }
      late_minutes?: number | null
    }>("/attendance/check-in", body)

    return {
      late_minutes: response.data?.data?.lateMinutes ?? response.data?.late_minutes ?? null,
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
    .post<{ data?: { lateMinutes?: number | null }; late_minutes?: number | null }>(
      "/attendance/check-in",
      payload
    )
    .then((r) => ({
      late_minutes: r.data?.data?.lateMinutes ?? r.data?.late_minutes ?? null,
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
