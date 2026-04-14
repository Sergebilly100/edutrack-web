import { apiClient as api } from "@/shared/api/client"

export type StudentItem = {
  id: string
  classId: string
  className: string
  firstName: string
  lastName: string
  parentPhone: string | null
  parentPhone2: string | null
  isActive: boolean
  createdAt: string
}

export type StudentsListQuery = {
  page?: number
  limit?: number
  classId?: string
  isActive?: boolean
  search?: string
}

export type StudentsListResponse = {
  data: StudentItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type CreateStudentPayload = {
  classId: string
  firstName: string
  lastName: string
  parentPhone?: string | null
  parentPhone2?: string | null
  isActive?: boolean
}

export type UpdateStudentPayload = {
  classId?: string
  firstName?: string
  lastName?: string
  parentPhone?: string | null
  parentPhone2?: string | null
  isActive?: boolean
}

export type AttendanceHistoryItem = {
  id: string
  date: string
  scheduleId: string | null
  studentId: string
  studentFirstName: string
  studentLastName: string
  classId: string
  className: string
  status: "present" | "absent" | "excused"
  markedBy: string | null
  smsStatus: "queued" | "sent" | "failed" | "delivered" | null
  smsNotified: boolean
  createdAt: string
}

export type AttendanceHistoryQuery = {
  page?: number
  limit?: number
  classId?: string
  studentId?: string
  scheduleId?: string
  dateFrom?: string
  dateTo?: string
}

export type AttendanceHistoryResponse = {
  data: AttendanceHistoryItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type TodayAbsenceGroup = {
  classId: string
  className: string
  absences: Array<{
    studentId: string
    studentFirstName: string
    studentLastName: string
    scheduleId: string | null
    date: string
    smsStatus: "queued" | "sent" | "failed" | "delivered" | null
    smsNotified: boolean
  }>
}

export const listStudents = (query: StudentsListQuery = {}) =>
  api
    .get<StudentsListResponse>("/students", {
      params: {
        page: query.page ?? 1,
        limit: query.limit ?? 100,
        class_id: query.classId,
        is_active:
          typeof query.isActive === "boolean" ? String(query.isActive) : undefined,
        search: query.search,
      },
    })
    .then((response) => response.data)

export const createStudent = (payload: CreateStudentPayload) =>
  api
    .post<{ data: StudentItem }>("/students", {
      class_id: payload.classId,
      first_name: payload.firstName,
      last_name: payload.lastName,
      parent_phone: payload.parentPhone ?? null,
      parent_phone_2: payload.parentPhone2 ?? null,
      is_active: payload.isActive ?? true,
    })
    .then((response) => response.data.data)

export const updateStudent = (studentId: string, payload: UpdateStudentPayload) =>
  api
    .put<{ data: StudentItem }>(`/students/${studentId}`, {
      class_id: payload.classId,
      first_name: payload.firstName,
      last_name: payload.lastName,
      parent_phone: payload.parentPhone,
      parent_phone_2: payload.parentPhone2,
      is_active: payload.isActive,
    })
    .then((response) => response.data.data)

export const deleteStudent = (studentId: string) =>
  api.delete<{ data: StudentItem }>(`/students/${studentId}`).then((response) => response.data.data)

export const bulkMarkAbsent = (scheduleId: string, date: string, absentStudentIds: string[]) =>
  api
    .post<{ data: { createdAttendances: number; emittedEvents: number } }>(
      "/attendance/students/bulk",
      {
        scheduleId,
        date,
        absences: absentStudentIds,
      }
    )
    .then((response) => response.data.data)

export const getAttendanceHistory = (query: AttendanceHistoryQuery = {}) =>
  api
    .get<AttendanceHistoryResponse>("/attendance/students", {
      params: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        class_id: query.classId,
        student_id: query.studentId,
        schedule_id: query.scheduleId,
        date_from: query.dateFrom,
        date_to: query.dateTo,
      },
    })
    .then((response) => response.data)

export const getTodayAbsences = () =>
  api
    .get<{ data: TodayAbsenceGroup[] }>("/attendance/students/today")
    .then((response) => response.data.data)
