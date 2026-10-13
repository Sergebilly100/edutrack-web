import { apiClient as api } from "@/shared/api/client"

export type StudentItem = {
  id: string
  classId: string | null
  className: string | null
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
  paymentSchoolYearId?: string
  paymentSchoolYearLabel?: string
  blockedReEnrollment?: boolean
}

export type StudentsListQuery = {
  page?: number
  limit?: number
  schoolYearId?: string
  includeBlockedReEnrollments?: boolean
  classId?: string
  levelId?: string
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
  classId?: string
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
  historicalSources?: Array<{ schoolYearLabel: string; oldClassName: string | null }>
  id: string
  firstName: string
  lastName: string
  matricule: string | null
  birthDate: string | null
  className: string | null
  classId: string | null
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

export type CurrentStudentProfile = StudentDetail & {
  activeSchoolYear: { id: string; label: string; startDate?: string; endDate?: string }
}

export type HistoricalStudentProfile = StudentDetail & {
  activeSchoolYear: { id: string; label: string; startDate?: string; endDate?: string } | null
  latestConfirmedSchoolYear: { id: string; label: string; className: string } | null
  confirmedInActiveYear: boolean
}

export type StudentYearResults = {
  studentId: string
  schoolYearId: string
  evaluations: Array<{ id: string; periodLabel: string; subjectName: string | null; label: string; score: number; maxScore: number; coefficient: number }>
  averages: Array<{ id: string; periodLabel: string; subjectName: string | null; average: number; rank: number | null }>
  conduct: Array<{ id: string; periodLabel: string; note: number; coefficient: number }>
}

export const getStudentYearResults = (studentId: string, schoolYearId: string) =>
  api.get<StudentYearResults>(`/students/${studentId}/academic-years/${schoolYearId}/results`).then((response) => response.data)

export type StudentDossierEvent = {
  type: "enrollment" | "payment" | "report_card" | "document"
  date: string
  label: string
  detail: string | null
  schoolYearId?: string | null
}

export type StudentDossier = {
  student: {
    id: string
    firstName: string
    lastName: string
    className: string
    matricule: string | null
  }
  events: StudentDossierEvent[]
}

export type StudentReportCardSummary = {
  id: string
  periodLabel: string
  schoolYearId: string
  schoolYearLabel: string
  className: string
  generalAverage: number
  rank: number
  classHeadcount: number
  publishedAt: string
}

export type StudentReportCardDetail = {
  id: string
  periodLabel: string
  className: string
  generalAverage: number
  rank: number
  classHeadcount: number
  classAverage: number
  status: "published"
  lines: Array<{
    id: string
    subjectName: string | null
    lineType: "subject" | "conduct"
    average: number
    coefficient: number
    rank: number | null
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
  teacherName: string
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
  levelId?: string
  subject?: string
  smsStatus?: "sent" | "not_sent" | "failed"
  minAbsences?: number
}

export type StudentAbsenceRecordsQuery = {
  from: string
  to: string
  subject?: string
  classId?: string
  levelId?: string
}

const fetchStudentList = (path: string, query: StudentsListQuery) =>
  api
    .get<StudentsListResponse>(path, {
      params: {
        page: query.page ?? 1,
        limit: query.limit ?? 100,
        class_id: query.classId,
        level_id: query.levelId,
        school_year_id: query.schoolYearId,
        include_blocked_reenrollments: query.includeBlockedReEnrollments ? "true" : undefined,
        is_active:
          typeof query.isActive === "boolean" ? String(query.isActive) : undefined,
        search: query.search,
      },
    })
    .then((response) => response.data)

export const listStudents = (query: StudentsListQuery = {}) => fetchStudentList("/students", query)
export const listHistoryProfiles = (query: StudentsListQuery = {}) => fetchStudentList("/students/history-directory", query)

export const listFinancialProfiles = (query: StudentsListQuery = {}) => fetchStudentList("/students/financial-profiles", query)

export const listCashierCandidates = (query: StudentsListQuery) => fetchStudentList("/students/cashier-candidates", query)

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

export const getCurrentStudentProfile = (studentId: string) =>
  api.get<{ data: CurrentStudentProfile }>(`/students/${studentId}/school-profile`).then((response) => response.data.data)

export const getHistoricalStudentProfile = (studentId: string) =>
  api.get<{ data: HistoricalStudentProfile }>(`/students/${studentId}/historical-profile`).then((response) => response.data.data)

export const getStudentDossier = (studentId: string) =>
  api.get<StudentDossier>(`/students/${studentId}/dossier`).then((response) => response.data)

export const listStudentReportCards = (studentId: string) =>
  api.get<{ reportCards: StudentReportCardSummary[] }>(`/students/${studentId}/report-cards`)
    .then((response) => response.data.reportCards)

export const getStudentReportCard = (studentId: string, cardId: string) =>
  api.get<{ reportCard: StudentReportCardDetail }>(`/students/${studentId}/report-cards/${cardId}`)
    .then((response) => response.data.reportCard)

export const requestStudentReportCardPdf = (studentId: string, cardId: string) =>
  api.post<{ jobId: string }>(`/students/${studentId}/report-cards/${cardId}/pdf`)
    .then((response) => response.data)

export const getStudentAbsenceStats = (query: StudentAbsenceStatsQuery) =>
  api
    .get<StudentAbsenceStat[]>("/students/absence-stats", {
      params: {
        from: query.from,
        to: query.to,
        class_id: query.classId,
        level_id: query.levelId,
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
      level_id: query.levelId,
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
        class_id: query.classId,
        level_id: query.levelId,
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
