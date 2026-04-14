import { apiClient as api } from "@/shared/api/client"

export type TenantPlan = "essential" | "pro" | "establishment"
export type TenantStatus = "trial" | "active" | "suspended" | "cancelled"

export type TenantListItem = {
  id: string
  name: string
  subdomain: string
  schemaName: string
  plan: TenantPlan
  status: TenantStatus
  activeUsers48h: number
  activeTeachers: number
  attendanceRate7d: number
  lastAttendanceAt: string | null
  estimatedMrrFcfa: number
  churnRisk: boolean
}

export type TenantListQuery = {
  page?: number
  limit?: number
  plan?: TenantPlan
  status?: TenantStatus
  churnRisk?: boolean
}

export type TenantListResponse = {
  tenants: TenantListItem[]
  summary: {
    activeTenants: number
    trialTenants: number
    totalMrrFcfa: number
    churnRiskTenants: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type CreateTenantPayload = {
  name: string
  subdomain: string
  plan: TenantPlan
  directorName: string
  directorPhone: string
  directorEmail?: string
}

export type UpdateTenantPayload = {
  plan?: TenantPlan
  status?: TenantStatus
}

export type TenantStatsResponse = {
  tenantId: string
  dau: number
  wau: number
  mau: number
  smsSent30d: number
  attendanceRateByDay: Array<{
    date: string
    attendanceRate: number
    total: number
  }>
  topTeachersByAbsence: Array<{
    teacherId: string
    teacherName: string
    absenceCount: number
  }>
}

export type ImpersonationResponse = {
  token: string
  tokenType: "Bearer"
  expiresIn: string
  tenantId: string
  schemaName: string
  readOnly: boolean
}

export const getTenants = (query: TenantListQuery = {}) =>
  api
    .get<TenantListResponse>("/admin/tenants", {
      params: query,
    })
    .then((response) => response.data)

export const createTenant = (payload: CreateTenantPayload) =>
  api.post("/admin/tenants", payload).then((response) => response.data)

export const updateTenant = (tenantId: string, payload: UpdateTenantPayload) =>
  api.patch<{ success: boolean }>(`/admin/tenants/${tenantId}`, payload).then((response) => response.data)

export const getTenantStats = (tenantId: string) =>
  api.get<TenantStatsResponse>(`/admin/tenants/${tenantId}/stats`).then((response) => response.data)

export const impersonateTenant = (tenantId: string) =>
  api
    .post<ImpersonationResponse>(`/admin/tenants/${tenantId}/impersonate`)
    .then((response) => response.data)

