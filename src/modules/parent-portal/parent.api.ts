import axios from "axios"
import { apiClient } from "@/shared/api/client"

const SUBDOMAIN_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const resolveTenantSubdomainFromHost = (): string | undefined => {
  const hostname = window.location.hostname.toLowerCase()
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return undefined
  }
  const labels = hostname.split(".").filter(Boolean)
  if (labels.length < 3) {
    return undefined
  }
  const subdomain = labels[0]
  if (!subdomain || subdomain === "www" || subdomain === "admin") {
    return undefined
  }
  return SUBDOMAIN_REGEX.test(subdomain) ? subdomain : undefined
}

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

export type ParentScheduleSlot = {
  time: string
  subject: string
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
  attendance_rate_month: number
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

export const parentLogin = async (payload: { phone: string; password: string }) => {
  try {
    const tenantSubdomain = resolveTenantSubdomainFromHost()
    const hostname = window.location.hostname.toLowerCase()
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1"
    const fallbackSchema =
      import.meta.env.VITE_DEFAULT_TENANT_SCHEMA ??
      import.meta.env.VITE_E2E_SCHEMA_NAME ??
      "school_sainte_marie"
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
        headers: tenantSubdomain
          ? { "x-tenant-subdomain": tenantSubdomain }
          : isLocalhost
            ? { "x-tenant-schema": fallbackSchema }
            : undefined,
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

export const getParentSchedule = async (studentId: string, week: string): Promise<ParentScheduleResponse> => {
  const response = await apiClient.get<ParentScheduleResponse>(`/parent/students/${studentId}/schedule`, {
    params: { week },
  })
  return response.data
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

export const getParentSubscriptionStatus = async (): Promise<ParentSubscriptionStatus> => {
  const response = await apiClient.get<ParentSubscriptionStatus>("/parent/subscription/status")
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
  const response = await apiClient.get<{ name?: string }>("/school/info")
  return { name: response.data.name ?? "Votre école" }
}
