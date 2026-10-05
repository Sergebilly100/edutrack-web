import axios from "axios"
import { z } from "zod"
import { apiClient } from "@/shared/api/client"
import { buildTenantContextHeaders } from "@/shared/tenancy/tenant-host"

const parseApiError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const code = error.response?.data?.code as string | undefined
    if (status === 401) return "Numéro ou mot de passe incorrect."
    if (status === 403 && code === "SUBSCRIPTION_EXPIRED")
      return "Votre abonnement a expiré. Contactez l'établissement pour renouveler."
    if (status === 403 && code === "SERVICE_NOT_AVAILABLE")
      return "Ce service n'est pas disponible pour votre école."
    if (status === 403 && code === "PASSWORD_CHANGE_REQUIRED")
      return "Vous devez modifier votre mot de passe temporaire."
  }
  if (error instanceof Error) return error.message
  return fallback
}

export type ParentStudent = {
  id: string
  first_name: string
  last_name: string
  class_name: string
}

export type ParentNotification = {
  id: string
  type: "payment_reminder"
  message: string
  createdAt: string
  readAt: string | null
  studentId: string | null
  studentName: string | null
}

export type ParentScheduleSlot = {
  time: string
  subject: string
  subjectDisplay: string
  teacher: string
  room: string
  status: "present" | "absent" | "upcoming" | "unknown"
}

export type ParentScheduleDay = {
  day: string
  slots: ParentScheduleSlot[]
}

export type ParentScheduleResponse = {
  week_label: string
  days: ParentScheduleDay[]
}

const ParentScheduleResponseSchema = z.object({
  week_label: z.string(),
  days: z.array(z.object({
    day: z.string(),
    slots: z.array(z.object({
      time: z.string(),
      subject: z.string(),
      subjectDisplay: z.string().optional(),
      teacher: z.string(),
      room: z.string(),
      status: z.enum(["present", "absent", "upcoming", "unknown"]),
    })),
  })),
})

export type ParentAbsenceRow = {
  date: string
  time_label: string
  subject: string
  teacher_name: string
  room_name: string
}

export type ParentStats = {
  absences_this_week: number
  absences_this_month: number
  /** Présent ou excusé / séances renseignées ; 100 sans séance (compatibilité). */
  attendance_rate_month: number
  /** Absences / séances renseignées (present, excused, late, absent), 0 sans donnée. */
  absence_rate_month: number
  total_absences_year: number
}

export type ParentSubscriptionStatus = {
  status: "active" | "expired" | "cancelled"
  starts_at: string
  ends_at: string
  days_remaining: number
  student_count: number
  monthly_amount_fcfa: number
  total_amount_fcfa: number
  duration_months: number
  auto_renew_alert: boolean
}

export type ParentSubscriptionStatusResponse = {
  subscription: ParentSubscriptionStatus | null
  offer: {
    available: boolean
    unit_price_fcfa: number | null
    billing: "per_child_per_month"
  }
}

export const parentLogin = async (payload: { phone: string; password: string }) => {
  try {
    const response = await apiClient.post<{
      accessToken: string
      refreshToken?: string
      tokenType: "Bearer"
      expiresIn: string
      user: {
        id: string
        role: "parent"
        phone: string
        fullName?: string
        email?: string
        studentIds: string[]
        mustChangePassword: boolean
      }
    }>(
      "/auth/login/parent",
      payload,
      {
        headers: buildTenantContextHeaders(),
      }
    ) 
    return response.data
  } catch (error) {
    throw new Error(parseApiError(error, "Vérifiez votre connexion internet et réessayez."))
  }
}

export const listParentStudents = async (): Promise<ParentStudent[]> => {
  const response = await apiClient.get<{ data: ParentStudent[] }>("/parent/students")
  return response.data.data
}

export const listParentNotifications = async (): Promise<{
  notifications: ParentNotification[]
  unreadCount: number
}> => {
  const response = await apiClient.get<{ notifications: ParentNotification[]; unreadCount: number }>("/parent/notifications")
  return response.data
}

export const markParentNotificationRead = async (notificationId: string): Promise<void> => {
  await apiClient.patch(`/parent/notifications/${notificationId}/read`)
}

export const markAllParentNotificationsRead = async (): Promise<void> => {
  await apiClient.patch("/parent/notifications/read-all")
}

export const getParentSchedule = async (studentId: string, week: string): Promise<ParentScheduleResponse> => {
  const response = await apiClient.get(`/parent/students/${studentId}/schedule`, {
    params: { week },
  })
  const parsed = ParentScheduleResponseSchema.parse(response.data)
  return {
    week_label: parsed.week_label,
    days: parsed.days.map((day) => ({
      day: day.day,
      slots: day.slots.map((slot) => ({ ...slot, subjectDisplay: slot.subjectDisplay || slot.subject })),
    })),
  }
}

export const getParentAbsences = async (studentId: string, month: string): Promise<ParentAbsenceRow[]> => {
  const response = await apiClient.get<{ data: ParentAbsenceRow[] }>(`/parent/students/${studentId}/absences`, {
    params: { month },
  })
  return response.data.data
}

export const getParentStats = async (studentId: string): Promise<ParentStats> => {
  const response = await apiClient.get<ParentStats>(`/parent/students/${studentId}/stats`)
  return response.data
}

export const getParentSubscriptionStatus = async (): Promise<ParentSubscriptionStatusResponse> => {
  const response = await apiClient.get<ParentSubscriptionStatusResponse>("/parent/subscription/status")
  return response.data
}

export const changeParentPassword = async (payload: {
  current_password: string
  new_password: string
}): Promise<void> => {
  try {
    await apiClient.post("/parent/auth/change-password", payload)
  } catch (error) {
    throw new Error(parseApiError(error, "Impossible de modifier votre mot de passe."))
  }
}

export const fetchParentSchoolInfo = async (): Promise<{ name: string }> => {
  const response = await apiClient.get<{ name?: string }>("/school/public-info", {
    headers: buildTenantContextHeaders(),
  })
  return { name: response.data.name ?? "Votre école" }
}

export const fetchParentSchoolConfig = async (): Promise<{ activeSchoolYear: string | null }> => {
  const response = await apiClient.get<{ activeSchoolYear?: string | null }>("/parent/school-config")
  return { activeSchoolYear: response.data.activeSchoolYear ?? null }
}

// ── Bulletins publiés (Tâche 5e) ────────────────────────────────────────────

export type ParentReportCardSummary = {
  id: string
  periodLabel: string
  schoolYearId: string
  schoolYearLabel: string
  generalAverage: number
  rank: number
  classHeadcount: number
  publishedAt: string
}

export type ParentReportCardsResponse = {
  reportCards: ParentReportCardSummary[]
  availableSchoolYears: Array<{ id: string; label: string }>
  inRevision: boolean
}

export const listParentReportCards = async (studentId: string, schoolYearId?: string): Promise<ParentReportCardsResponse> => {
  const response = await apiClient.get<ParentReportCardsResponse>(
    `/parent/students/${studentId}/report-cards`,
    { params: schoolYearId ? { schoolYearId } : undefined },
  )
  return response.data
}

export const requestParentReportCardPdf = async (
  studentId: string,
  cardId: string,
): Promise<string> => {
  const response = await apiClient.post<{ jobId: string }>(
    `/parent/students/${studentId}/report-cards/${cardId}/pdf`,
  )
  return response.data.jobId
}

// ── Vue d'ensemble enrichie (17b) ───────────────────────────────────────────

export type ParentFinancialPreview = {
  status: "up_to_date" | "late" | "waived"
  daysLate: number | null
  totalPaid: number
  totalDueYear: number
  remainingDue: number
  lastComputedAt: string
}

export type ParentLatestReportCard = {
  id: string
  periodLabel: string
  schoolYearLabel: string
  generalAverage: number
  rank: number
  classHeadcount: number
  publishedAt: string
}

export type ParentOverview = {
  financial: ParentFinancialPreview | null
  latestPublishedReportCard: ParentLatestReportCard | null
}

export const getParentOverview = async (studentId: string): Promise<ParentOverview> => {
  const response = await apiClient.get<ParentOverview>(`/parent/students/${studentId}/overview`)
  return response.data
}
