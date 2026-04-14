import axios from "axios"

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL, withCredentials: true })

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
  api.post<CheckInResponse>("/attendance/check-in", payload).then((r) => r.data)

export const qrScan = (payload: QrScanPayload) =>
  api.post<QrScanResponse>("/attendance/qr-scan", payload).then((r) => r.data)

export const bulkStudents = (payload: BulkStudentsPayload) =>
  api.post<BulkStudentsResponse>("/attendance/students/bulk", payload).then((r) => r.data)

export const fetchStudents = (classId: string) =>
  api.get<StudentItem[]>("/students", { params: { class_id: classId } }).then((r) => r.data)

export const fetchRooms = () => api.get<RoomItem[]>("/rooms").then((r) => r.data)
