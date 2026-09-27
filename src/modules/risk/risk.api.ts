import { apiClient } from "@/shared/api/client"

export type RiskSubjectType = "student" | "teacher"

export type RiskSignalType = "absences" | "grades" | "payments" | "lateness"

export type RiskAlertRule = {
  id: string
  subjectType: RiskSubjectType
  signalType: RiskSignalType
  thresholdValue: number
  periodDays: number
  isActive: boolean
  lateMinutes?: number | null
}

export type SaveRiskAlertRuleInput = {
  subjectType: RiskSubjectType
  signalType: RiskSignalType
  thresholdValue: number
  periodDays: number
  isActive: boolean
  lateMinutes?: number | null
}

export const fetchRiskAlertRules = async (): Promise<RiskAlertRule[]> => {
  const response = await apiClient.get<{ rules: RiskAlertRule[] }>("/risk/rules")
  return response.data.rules ?? []
}

export const saveRiskAlertRule = async ({
  subjectType,
  signalType,
  thresholdValue,
  periodDays,
  isActive,
  lateMinutes,
}: SaveRiskAlertRuleInput): Promise<void> => {
  await apiClient.put(`/risk/rules/${subjectType}/${signalType}`, {
    thresholdValue,
    periodDays,
    isActive,
    ...(lateMinutes !== undefined ? { lateMinutes } : {}),
  })
}
