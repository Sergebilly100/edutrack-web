import { apiClient } from "@/shared/api/client"

export type ClassDecisionValue = "promoted" | "repeat" | "expelled"

export type EndOfYearSchoolYear = {
  id: string
  label: string
  endDate: string
  endOfYearReviewStartDate: string
}

export type EndOfYearReviewStatus = {
  visible: boolean
  activeSchoolYear: EndOfYearSchoolYear | null
}

export type ClassDecision = {
  studentId: string
  studentFirstName: string
  studentLastName: string
  studentMatricule: string | null
  className: string
  currentLevelName: string
  generalAverage: number | null
  suggestedDecision: ClassDecisionValue | null
  finalDecision: ClassDecisionValue | null
  nextLevelId: string | null
  nextLevelName: string | null
  validatedAt: string | null
}

export type LevelOption = { id: string; name: string; orderIndex: number }
export type ClassOption = { id: string; name: string; levelId: string }
export type ClassDecisionsResponse = {
  schoolYear: EndOfYearSchoolYear
  decisions: ClassDecision[]
  levels: LevelOption[]
  classes: ClassOption[]
}

export async function getEndOfYearReviewStatus(): Promise<EndOfYearReviewStatus> {
  const response = await apiClient.get<EndOfYearReviewStatus>("/class-decisions/review-status")
  return response.data
}

export async function listClassDecisions(): Promise<ClassDecisionsResponse> {
  return listFilteredClassDecisions()
}

export async function listFilteredClassDecisions(filters: { levelId?: string; classId?: string } = {}): Promise<ClassDecisionsResponse> {
  const response = await apiClient.get<ClassDecisionsResponse>("/class-decisions", { params: { level_id: filters.levelId, class_id: filters.classId } })
  return response.data
}

export async function validateClassDecision(
  studentId: string,
  payload: { finalDecision: ClassDecisionValue; nextLevelId: string | null },
): Promise<ClassDecision> {
  const response = await apiClient.patch<{ decision: ClassDecision }>(`/class-decisions/${studentId}`, payload)
  return response.data.decision
}
