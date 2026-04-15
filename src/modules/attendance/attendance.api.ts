import { apiClient as api } from "@/shared/api/client"

export type CheckInPayload = { schedule_id: string }
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
    .post<{ data?: { roomMismatch?: boolean }; room_mismatch?: boolean }>("/attendance/qr-scan", payload)
    .then((r) => ({
      room_mismatch: r.data?.data?.roomMismatch ?? r.data?.room_mismatch ?? false,
    }))

export const bulkStudents = (payload: BulkStudentsPayload) =>
  api
    .post<{ data?: { createdAttendances?: number } }>(
      "/attendance/students/bulk",
      {
        scheduleId: payload.schedule_id,
        date: payload.date,
        absences: payload.absent_student_ids,
      }
    )
    .then((r) => ({
      success: (r.data?.data?.createdAttendances ?? 0) >= 0,
    }))

export const fetchStudents = (classId: string) =>
  api
    .get<{ data?: Array<{ id: string; firstName?: string; lastName?: string; first_name?: string; last_name?: string }> }>(
      "/students",
      { params: { class_id: classId } }
    )
    .then((r) =>
      (r.data?.data ?? []).map((student) => ({
        id: student.id,
        full_name:
          `${student.firstName ?? student.first_name ?? ""} ${student.lastName ?? student.last_name ?? ""}`.trim(),
      }))
    )

export const fetchRooms = () => api.get<RoomItem[]>("/rooms").then((r) => r.data)
