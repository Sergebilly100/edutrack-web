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
  suggestedDecision: ClassDecisionValue | null
  finalDecision: ClassDecisionValue | null
  nextLevelId: string | null
  nextLevelName: string | null
  validatedAt: string | null
}

export type LevelOption = { id: string; name: string; orderIndex: number }
export type ClassDecisionsResponse = {
  schoolYear: EndOfYearSchoolYear
  decisions: ClassDecision[]
  levels: LevelOption[]
}

export async function getEndOfYearReviewStatus(): Promise<EndOfYearReviewStatus> {
  const response = await apiClient.get<EndOfYearReviewStatus>("/class-decisions/review-status")
  return response.data
}

export async function listClassDecisions(): Promise<ClassDecisionsResponse> {
  const response = await apiClient.get<ClassDecisionsResponse>("/class-decisions")
  return response.data
}

export async function validateClassDecision(
  studentId: string,
  payload: { finalDecision: ClassDecisionValue; nextLevelId: string | null },
): Promise<ClassDecision> {
  const response = await apiClient.patch<{ decision: ClassDecision }>(`/class-decisions/${studentId}`, payload)
  return response.data.decision
}
