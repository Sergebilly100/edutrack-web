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
  currentLevelId: string
  currentLevelName: string
  generalAverage: number | null
  suggestedDecision: ClassDecisionValue | null
  finalDecision: ClassDecisionValue | null
  nextLevelId: string | null
  nextLevelName: string | null
  validatedAt: string | null
}

export type BulkClassDecisionRule = {
  finalDecision: ClassDecisionValue
  nextLevelId: string | null
}

export type BulkClassDecisionsPayload = {
  levelId?: string
  classId?: string
  threshold: number
  atOrAbove: BulkClassDecisionRule
  below: BulkClassDecisionRule
}

export type BulkClassDecisionPreviewItem = ClassDecision & {
  proposedDecision: ClassDecisionValue | null
  proposedNextLevelId: string | null
  proposedNextLevelName: string | null
  isEligible: boolean
  blockingReason: "GENERAL_AVERAGE_PENDING" | null
}

export type BulkClassDecisionsPreview = {
  items: BulkClassDecisionPreviewItem[]
  eligibleCount: number
  pendingCount: number
  canApply: boolean
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

export async function previewBulkClassDecisions(payload: BulkClassDecisionsPayload): Promise<BulkClassDecisionsPreview> {
  const response = await apiClient.post<BulkClassDecisionsPreview>("/class-decisions/bulk-preview", payload)
  return response.data
}

export async function validateBulkClassDecisions(payload: BulkClassDecisionsPayload): Promise<BulkClassDecisionsPreview> {
  const response = await apiClient.post<BulkClassDecisionsPreview>("/class-decisions/bulk-validate", payload)
  return response.data
}
