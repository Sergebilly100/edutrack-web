import { apiClient as api } from "@/shared/api/client"
import { asBoolean, asNumber, asString, isRecord } from "@/shared/utils/parsers"

export type SchoolYearStatus = "draft" | "active" | "closed"

export type SchoolYear = {
  id: string
  label: string
  startDate: string
  endDate: string
  endOfYearReviewStartDate: string
  status: SchoolYearStatus
  createdAt: string
  updatedAt: string
}

export type Level = {
  id: string
  name: string
  orderIndex: number
  isExamClass: boolean
  createdAt: string
  updatedAt: string
}

export type SchoolClass = {
  id: string
  name: string
  studentCount: number
  isActive: boolean
  level: Pick<Level, "id" | "name" | "orderIndex">
  schoolYear: Pick<SchoolYear, "id" | "label">
  homeroomTeacher: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export type SchoolYearReviewPayload = { endOfYearReviewStartDate: string }

export type LevelPayload = {
  name: string
  orderIndex: number
  isExamClass: boolean
}

export type ClassPayload = {
  name: string
  levelId: string
  homeroomTeacherId: string | null
}

export type ClassesResponse = {
  schoolYear: SchoolYear | null
  activeSchoolYear: SchoolYear | null
  classes: SchoolClass[]
}

const asRecord = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {}

const parseStatus = (value: unknown): SchoolYearStatus =>
  value === "active" || value === "closed" ? value : "draft"

const parseSchoolYear = (value: unknown): SchoolYear => {
  const row = asRecord(value)
  return {
    id: asString(row.id),
    label: asString(row.label),
    startDate: asString(row.startDate ?? row.start_date),
    endDate: asString(row.endDate ?? row.end_date),
    endOfYearReviewStartDate: asString(row.endOfYearReviewStartDate ?? row.end_of_year_review_start_date),
    status: parseStatus(row.status),
    createdAt: asString(row.createdAt ?? row.created_at),
    updatedAt: asString(row.updatedAt ?? row.updated_at),
  }
}

const parseLevel = (value: unknown): Level => {
  const row = asRecord(value)
  return {
    id: asString(row.id),
    name: asString(row.name),
    orderIndex: asNumber(row.orderIndex ?? row.order_index),
    isExamClass: asBoolean(row.isExamClass ?? row.is_exam_class),
    createdAt: asString(row.createdAt ?? row.created_at),
    updatedAt: asString(row.updatedAt ?? row.updated_at),
  }
}

const parseClass = (value: unknown): SchoolClass => {
  const row = asRecord(value)
  const level = asRecord(row.level)
  const schoolYear = asRecord(row.schoolYear ?? row.school_year)
  const teacherValue = row.homeroomTeacher ?? row.homeroom_teacher
  const teacher = isRecord(teacherValue) ? teacherValue : null

  return {
    id: asString(row.id),
    name: asString(row.name),
    studentCount: asNumber(row.studentCount ?? row.student_count),
    isActive: asBoolean(row.isActive ?? row.is_active),
    level: {
      id: asString(level.id),
      name: asString(level.name),
      orderIndex: asNumber(level.orderIndex ?? level.order_index),
    },
    schoolYear: {
      id: asString(schoolYear.id),
      label: asString(schoolYear.label),
    },
    homeroomTeacher: teacher
      ? { id: asString(teacher.id), name: asString(teacher.name) }
      : null,
    createdAt: asString(row.createdAt ?? row.created_at),
    updatedAt: asString(row.updatedAt ?? row.updated_at),
  }
}

export async function listSchoolYears(): Promise<SchoolYear[]> {
  const response = await api.get("/school-years")
  const payload = asRecord(response.data)
  const rows = Array.isArray(payload.schoolYears) ? payload.schoolYears : []
  return rows.map(parseSchoolYear)
}

export async function updateSchoolYearReviewDate(id: string, payload: SchoolYearReviewPayload): Promise<SchoolYear> {
  const response = await api.patch(`/school-years/${id}`, payload)
  return parseSchoolYear(asRecord(response.data).schoolYear)
}

export async function listLevels(): Promise<Level[]> {
  const response = await api.get("/levels")
  const payload = asRecord(response.data)
  const rows = Array.isArray(payload.levels) ? payload.levels : []
  return rows.map(parseLevel)
}

export async function createLevel(payload: LevelPayload): Promise<Level> {
  const response = await api.post("/levels", payload)
  return parseLevel(asRecord(response.data).level)
}

export async function updateLevel(id: string, payload: LevelPayload): Promise<Level> {
  const response = await api.patch(`/levels/${id}`, payload)
  return parseLevel(asRecord(response.data).level)
}

export async function listClasses(schoolYearId?: string): Promise<ClassesResponse> {
  const response = await api.get("/classes", {
    params: schoolYearId ? { schoolYearId } : undefined,
  })
  const payload = asRecord(response.data)
  const rows = Array.isArray(payload.classes) ? payload.classes : []
  const schoolYearValue = payload.schoolYear ?? payload.activeSchoolYear

  return {
    schoolYear: isRecord(schoolYearValue) ? parseSchoolYear(schoolYearValue) : null,
    activeSchoolYear: isRecord(payload.activeSchoolYear)
      ? parseSchoolYear(payload.activeSchoolYear)
      : null,
    classes: rows.map(parseClass),
  }
}

export async function createClass(payload: ClassPayload): Promise<SchoolClass> {
  const response = await api.post("/classes", payload)
  return parseClass(asRecord(response.data).class)
}

export async function updateClass(id: string, payload: ClassPayload): Promise<SchoolClass> {
  const response = await api.patch(`/classes/${id}`, payload)
  return parseClass(asRecord(response.data).class)
}

export async function archiveClass(id: string): Promise<SchoolClass> {
  const response = await api.delete(`/classes/${id}`)
  return parseClass(asRecord(response.data).class)
}

// ── Notes / Évaluations (espace prof, Tâche 5d) ─────────────────────────────

export type EvaluationType = "scheduled" | "spontaneous"

export type EvaluationGradeItem = {
  studentId: string
  score: number
  maxScore: number
  comment: string | null
}

export type EvaluationWithGrades = {
  id: string
  label: string
  type: EvaluationType
  coefficient: number
  subjectId: string | null
  subjectName: string | null
  grades: EvaluationGradeItem[]
}

export type LessonSlot = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  subjectName: string
}

export type EvaluationsScope = {
  lessonSlots: LessonSlot[]
  subjects: Array<{ id: string; name: string; coefficient: number }>
  evaluations: EvaluationWithGrades[]
}

const DAY_LABELS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

export const dayLabel = (day: number): string => DAY_LABELS[day] ?? `Jour ${day}`

export const fetchEvaluationsScope = (classId: string, gradingPeriodId: string) =>
  api
    .get<EvaluationsScope>("/evaluations/scope", { params: { classId, gradingPeriodId } })
    .then((response) => response.data)

export const createEvaluation = (payload: {
  lessonSlotId: string
  subjectId: string
  classId: string
  gradingPeriodId: string
  type: EvaluationType
  coefficient: number
  label: string
}) => api.post<{ evaluation: { id: string } }>("/evaluations", payload).then((r) => r.data.evaluation)

export const upsertEvaluationGrade = (
  evaluationId: string,
  payload: { studentId: string; score: number; maxScore: number; comment?: string | null }
) => api.put(`/evaluations/${evaluationId}/grades`, payload).then((r) => r.data)

export const markSubjectCompleted = (payload: {
  classId: string
  subjectId: string
  gradingPeriodId: string
  status: "in_progress" | "completed"
}) => api.put("/class-subject-completion", payload).then((r) => r.data)

// ── Conduite (Tâche 5b) ─────────────────────────────────────────────────────

export const submitConductInput = (payload: {
  student_id: string
  grading_period_id: string
  note: number
  observation?: string
}) => api.post("/conduct/inputs", payload).then((r) => r.data)

export type ConductOverviewResponse = {
  student: { id: string; fullName: string; className: string }
  gradingPeriod: { id: string; label: string }
  teacherInputs: Array<{
    id: string
    teacherName: string
    subjectLabel: string | null
    note: number
    observation: string | null
    createdAt: string
  }>
  spontaneousEvaluations: Array<{
    id: string
    label: string
    score: number
    maxScore: number
    comment: string | null
    createdAt: string
  }>
  finalGrade: { note: number; coefficient: number; decidedByUserId: string; decidedAt: string } | null
}

export const fetchConductOverview = (studentId: string, gradingPeriodId: string) =>
  api
    .get<ConductOverviewResponse>(`/conduct/students/${studentId}/overview`, {
      params: { grading_period_id: gradingPeriodId },
    })
    .then((response) => response.data)

export const decideConductGrade = (payload: {
  student_id: string
  grading_period_id: string
  note: number
  coefficient?: number
}) => api.put("/conduct/grades", payload).then((r) => r.data)

// ── Suivi de complétude (direction) ─────────────────────────────────────────

export type CompletionSubject = {
  subjectId: string
  subjectName: string
  subjectCoefficient: number
  status: "in_progress" | "completed"
  completedAt: string | null
  teacher: { id: string; name: string } | null
}

export const fetchClassCompletion = (classId: string, gradingPeriodId: string) =>
  api
    .get<{ subjects: CompletionSubject[] }>("/report-cards/completion", {
      params: { classId, gradingPeriodId },
    })
    .then((response) => response.data)

// ── Bulletins côté direction (Tâche 5e) ─────────────────────────────────────

export type ReportCardSummary = {
  id: string
  studentName: string
  generalAverage: number
  rank: number
  status: "generated" | "published"
}

export const fetchClassReportCards = (classId: string, gradingPeriodId: string) =>
  api
    .get<{ reportCards: ReportCardSummary[] }>(`/report-cards/class/${classId}`, {
      params: { grading_period_id: gradingPeriodId },
    })
    .then((response) => response.data.reportCards)

export const fetchReadiness = (gradingPeriodId: string) =>
  api
    .get<{ classes: Array<{ classId: string; className: string; headcount: number; studentsWithGeneralAverage: number; readyToGenerate: boolean }> }>(
      "/report-cards/readiness",
      { params: { grading_period_id: gradingPeriodId } },
    )
    .then((response) => response.data.classes)

export const generateReportCards = (payload: { class_id: string; grading_period_id: string }) =>
  api.post<{ generatedCount: number }>("/report-cards/generate", payload).then((r) => r.data)

export const publishReportCard = (cardId: string) =>
  api.post(`/report-cards/${cardId}/publish`).then((r) => r.data)

export const publishBulkReportCards = (payload: { class_id: string; grading_period_id: string }) =>
  api.post<{ publishedCount: number }>("/report-cards/publish-bulk", payload).then((r) => r.data)

export const requestReportCardPdf = (cardId: string) =>
  api.post<{ jobId: string }>(`/report-cards/${cardId}/pdf`).then((r) => r.data.jobId)
