import { apiClient } from "@/shared/api/client"

export type ReviewOption = { id: string; label: string }
export type ReviewOptions = {
  schoolYears: Array<ReviewOption & { active: boolean }>
  gradingPeriods: Array<ReviewOption & { schoolYearId: string; isCurrent: boolean; notesEntryOpen: boolean; isFuture: boolean; hasEvaluations: boolean }>
  levels: ReviewOption[]
  classes: Array<ReviewOption & { levelId: string }>
  subjects: Array<ReviewOption & { levelId: string }>
  teachers: ReviewOption[]
}
export type ReviewFilters = {
  schoolYearId: string
  gradingPeriodId: string
  levelId?: string
  classId?: string
  subjectId?: string
  teacherId?: string
  studentSearch?: string
  page: number
  pageSize?: number
  sort?: "delay" | "teacher" | "class"
}
export type ReviewEvaluation = {
  id: string
  label: string
  date: string | null
  type: "scheduled" | "spontaneous"
  coefficient: number
  subject: { id: string; name: string }
  teacher: { id: string; name: string }
  class: { id: string; name: string }
  level: { id: string; name: string }
  period: { id: string; name: string }
  notes: Array<{ studentId: string; studentName: string; score: number | null; maxScore: number | null; comment: string | null }>
  expectedCount: number
  enteredCount: number
  lastReminderAt: string | null
}
export type ReviewResult = {
  items: ReviewEvaluation[]
  summary: { evaluations: number; grades: number; missing: number }
  policy: { graceDays: number; lateDays: number }
  page: number
  pageSize: number
  total: number
}

export type SpontaneousReviewResult = {
  students: Array<{
    id: string
    name: string
    matricule: string | null
    subjects: Array<{
      id: string
      name: string
      notes: Array<{
        evaluationId: string
        date: string | null
        adjustment: number
        teacher: { id: string; name: string }
        className: string
        comment: string | null
      }>
    }>
  }>
  totalStudents: number
  totalNotes: number
  page: number
  pageSize: number
}

export const fetchReviewOptions = (params: { schoolYearId?: string; gradingPeriodId?: string; levelId?: string; classId?: string; subjectId?: string }) =>
  apiClient.get<ReviewOptions>("/academic/evaluations/options", { params }).then((response) => response.data)

export const fetchEvaluationReview = (params: ReviewFilters) =>
  apiClient.get<ReviewResult>("/academic/evaluations", { params }).then((response) => response.data)

export const fetchSpontaneousReview = (params: ReviewFilters) =>
  apiClient.get<SpontaneousReviewResult>("/academic/evaluations/spontaneous", { params }).then((response) => response.data)

export const remindEvaluationTeacher = ({ evaluationId, force }: { evaluationId: string; force?: boolean }): Promise<{ lastReminderAt: string }> =>
  apiClient.post<{ lastReminderAt: string }>(`/academic/evaluations/${evaluationId}/remind`, force ? { force: true } : {}).then((response) => response.data)
