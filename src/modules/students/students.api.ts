import { apiClient as api } from "@/shared/api/client"

export type StudentItem = {
  id: string
  classId: string
  className: string
  firstName: string
  lastName: string
  matricule: string | null
  birthDate: string | null
  parentName?: string | null
  parentPhone: string | null
  parentEmail?: string | null
  parentName2?: string | null
  parentPhone2: string | null
  note?: string | null
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
  matricule?: string | null
  birthDate?: string | null
  parentName?: string | null
  parentPhone?: string | null
  parentEmail?: string | null
  parentName2?: string | null
  parentPhone2?: string | null
  note?: string | null
  isActive?: boolean
}

export type UpdateStudentPayload = {
  classId?: string
  firstName?: string
  lastName?: string
  matricule?: string | null
  birthDate?: string | null
  parentName?: string | null
  parentPhone?: string | null
  parentEmail?: string | null
  parentName2?: string | null
  parentPhone2?: string | null
  note?: string | null
  isActive?: boolean
}

export type StudentDetail = {
  id: string
  firstName: string
  lastName: string
  matricule: string | null
  birthDate: string | null
  className: string
  classId: string
  isActive: boolean
  parentPhone: string | null
  parentEmail: string | null
  parentPhone2: string | null
  parentName: string | null
  parentName2: string | null
  note: string | null
  createdAt: string
  absenceSummary: {
    total: number
    excused: number
    thisMonth: number
    thisWeek: number
  }
  recentAbsences: Array<{
    id: string
    date: string
    subject: string
    teacherName: string
    startTime: string | null
    endTime: string | null
    roomName: string | null
    smsStatus: "sent" | "failed" | "not_sent" | null
    status: "absent" | "excused"
    excuseReason: string | null
  }>
  documents: Array<{
    id: string
    fileName: string
    fileUrl: string
    uploadedAt: string
  }>
  parentSms: Array<{
    id: string
    date: string
    reason: string
    recipientPhone: string
    status: "queued" | "sent" | "failed" | "delivered"
  }>
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
    createdAt: string
    smsStatus: "queued" | "sent" | "failed" | "delivered" | null
    smsNotified: boolean
    status: "absent" | "excused"
  }>
}

export type StudentAbsenceStat = {
  studentId: string
  studentName: string
  className: string
  classId: string
  parentPhone: string | null
  parentPhone2: string | null
  absenceCount: number
  excusedCount: number
  totalScheduled: number
  absenceRate: number
  smsSummary: "all_sent" | "partial" | "none"
}

export type StudentAbsenceRecord = {
  id: string
  date: string
  subject: string
  className: string
  startTime: string
  endTime: string
  status: "absent" | "excused"
  excuseReason: string | null
  smsPhone1: { phone: string | null; status: "sent" | "failed" | "not_sent"; sentAt: string | null }
  smsPhone2: { phone: string | null; status: "sent" | "failed" | "not_sent"; sentAt: string | null }
}

export type StudentAbsenceStatsQuery = {
  from: string
  to: string
  classId?: string
  subject?: string
  smsStatus?: "sent" | "not_sent" | "failed"
  minAbsences?: number
}

export type StudentAbsenceRecordsQuery = {
  from: string
  to: string
  subject?: string
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
      matricule: payload.matricule ?? null,
      birth_date: payload.birthDate ?? null,
      parent_name: payload.parentName ?? null,
      parent_phone: payload.parentPhone ?? null,
      parent_email: payload.parentEmail ?? null,
      parent_name_2: payload.parentName2 ?? null,
      parent_phone_2: payload.parentPhone2 ?? null,
      notes: payload.note ?? null,
      is_active: payload.isActive ?? true,
    })
    .then((response) => response.data.data)

export const updateStudent = (studentId: string, payload: UpdateStudentPayload) =>
  api
    .put<{ data: StudentItem }>(`/students/${studentId}`, {
      class_id: payload.classId,
      first_name: payload.firstName,
      last_name: payload.lastName,
      matricule: payload.matricule,
      birth_date: payload.birthDate,
      parent_name: payload.parentName,
      parent_phone: payload.parentPhone,
      parent_email: payload.parentEmail,
      parent_name_2: payload.parentName2,
      parent_phone_2: payload.parentPhone2,
      notes: payload.note,
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

export const getStudentById = (studentId: string) =>
  api.get<{ data: StudentDetail }>(`/students/${studentId}`).then((response) => response.data.data)

export const getStudentAbsenceStats = (query: StudentAbsenceStatsQuery) =>
  api
    .get<StudentAbsenceStat[]>("/students/absence-stats", {
      params: {
        from: query.from,
        to: query.to,
        class_id: query.classId,
        subject: query.subject,
        sms_status: query.smsStatus,
        min_absences: query.minAbsences ?? 1,
      },
    })
    .then((response) => response.data as StudentAbsenceStat[])

/**
 * Lance la génération du bilan PDF des absences élèves (job asynchrone).
 * Remplace l'ancien export CSV navigateur ; le frontend poll ensuite
 * /jobs/:id/status puis télécharge le PDF brandé.
 */
export const exportStudentAbsences = async (
  query: StudentAbsenceStatsQuery & { student_label?: string }
): Promise<{ jobId: string }> => {
  const response = await api.get("/students/absence-stats/export", {
    params: {
      from: query.from,
      to: query.to,
      class_id: query.classId,
      subject: query.subject,
      sms_status: query.smsStatus,
      min_absences: query.minAbsences ?? 1,
      student_label: query.student_label,
    },
  })
  const payload = (response.data ?? {}) as { jobId?: string | number }
  return { jobId: String(payload.jobId ?? "") }
}

export const getStudentAbsenceRecords = (
  studentId: string,
  query: StudentAbsenceRecordsQuery
) =>
  api
    .get<StudentAbsenceRecord[]>(`/students/${studentId}/absences`, {
      params: {
        from: query.from,
        to: query.to,
        subject: query.subject,
      },
    })
    .then((response) => response.data as StudentAbsenceRecord[])

export const excuseAbsence = (attendanceId: string, reason: string) =>
  api
    .patch<{ data: { id: string; status: string; excuseReason: string } }>(
      `/students/absences/${attendanceId}/excuse`,
      { reason }
    )
    .then((response) => response.data.data)

export const retrySmsNotification = (notificationId: string) =>
  api
    .post<{ success: boolean; queueRef: string }>(`/notifications/${notificationId}/retry`)
    .then((response) => response.data)
