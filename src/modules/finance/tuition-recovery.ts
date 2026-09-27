import axios from "axios"
import { ApiError } from "@/shared/api/client"
import { isRecord } from "@/shared/utils/parsers"
import type { TuitionPlan } from "./finance.api"

export type TuitionRequiredContext = {
  schoolYearId: string
  schoolYearLabel: string
  levelId: string
  levelName: string
}

export type TuitionRecovery = TuitionRequiredContext & {
  enrollmentId: string
  returnTo: string
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isContext = (value: unknown): value is TuitionRequiredContext => isRecord(value)
  && typeof value.schoolYearId === "string" && uuid.test(value.schoolYearId)
  && typeof value.levelId === "string" && uuid.test(value.levelId)
  && typeof value.schoolYearLabel === "string" && value.schoolYearLabel.trim().length > 0
  && typeof value.levelName === "string" && value.levelName.trim().length > 0

export function getMissingTuition(error: unknown): { context?: TuitionRequiredContext } | null {
  const original = error instanceof ApiError ? error.cause : error
  if (!axios.isAxiosError(original)) return error instanceof ApiError && error.code === "TUITION_PLAN_REQUIRED" ? {} : null
  const data: unknown = original.response?.data
  if (!isRecord(data) || data.code !== "TUITION_PLAN_REQUIRED") return null
  return isContext(data.context) ? { context: data.context } : {}
}

// Only a canonical relative payment path is accepted: same origin/tenant and dossier.
export function safePaymentReturn(returnTo: string | null, enrollmentId: string): string | null {
  if (!uuid.test(enrollmentId)) return null
  const expected = `/enrollments/${enrollmentId}/payment`
  return returnTo === expected ? expected : null
}

export function tuitionSettingsUrl(context: TuitionRequiredContext, enrollmentId: string): string | null {
  const returnTo = safePaymentReturn(`/enrollments/${enrollmentId}/payment`, enrollmentId)
  if (!returnTo || !isContext(context)) return null
  const params = new URLSearchParams({ tab: "finance", ...context, enrollmentId, returnTo })
  return `/settings?${params}`
}

export function readTuitionRecovery(params: URLSearchParams): TuitionRecovery | null {
  if (params.get("tab") !== "finance") return null
  const context = {
    schoolYearId: params.get("schoolYearId"), schoolYearLabel: params.get("schoolYearLabel"),
    levelId: params.get("levelId"), levelName: params.get("levelName"),
  }
  const enrollmentId = params.get("enrollmentId") ?? ""
  const returnTo = safePaymentReturn(params.get("returnTo"), enrollmentId)
  return isContext(context) && returnTo ? { ...context, enrollmentId, returnTo } : null
}

export function planResolvesRecovery(plan: TuitionPlan, recovery: TuitionRecovery): boolean {
  return plan.schoolYearId === recovery.schoolYearId && plan.levelId === recovery.levelId
    && plan.totalAmount > 0
}
