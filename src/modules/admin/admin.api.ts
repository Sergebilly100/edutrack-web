import { apiClient as api } from "@/shared/api/client"

export type TenantPlan = "essential" | "pro" | "establishment"
export type TenantStatus = "trial" | "active" | "suspended" | "cancelled"
export type TeachingType = "primaire" | "secondaire" | "superieur" | "mixte"

export type SchoolListItem = {
  tenantId: string
  name: string
  plan: TenantPlan
  status: TenantStatus
  nbUsers: number
  lastConnection: string | null
  mrrFcfa: number
}

export type SchoolListResponse = {
  schools: SchoolListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type SchoolListQuery = {
  page?: number
  limit?: number
}

export type CreateSchoolPayload = {
  name: string
  subdomain: string
  city: string
  teaching_type: TeachingType
  plan: TenantPlan
  max_admin_positions: number
  director_name: string
  director_phone: string
  director_email?: string
}

export type CreateSchoolResponse = {
  tenantId: string
  schoolSchemaName: string
  directorCredentials: {
    userId: string
    name: string
    phone: string
    email: string | null
    password: string
  }
}

export type SchoolDetailsResponse = {
  tenantId: string
  metadata: {
    name: string
    subdomain: string
    schemaName: string
    plan: TenantPlan
    status: TenantStatus
    city: string | null
    teachingType: TeachingType | null
    maxAdminPositions: number
    createdAt: string
    updatedAt: string
  }
  usageStats: {
    nbUsers: number
    activeUsers7d: number
    teachersCount: number
    studentsCount: number
    attendanceRecords30d: number
    mrrFcfa: number
    lastConnection: string | null
  }
  connectionHistory30d: Array<{
    date: string
    uniqueUsers: number
  }>
}

export type UpdateSchoolConfigPayload = {
  max_admin_positions?: number
  plan?: TenantPlan
  status?: TenantStatus
}

export type AdminMetricsResponse = {
  totalSchools: number
  activeSchools: number
  mrrTotalFcfa: number
  dauLast7d: Array<{
    date: string
    uniqueUsers: number
  }>
  schoolsByPlan: Array<{
    plan: TenantPlan
    count: number
  }>
}

export type RevenueMetricsResponse = Array<{
  month: string
  mrr_fcfa: number
  payments_count: number
}>

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

export const listSchools = (query: SchoolListQuery = {}) =>
  api
    .get<SchoolListResponse>("/admin/schools", {
      params: query,
    })
    .then((response) => response.data)

export const createSchool = (payload: CreateSchoolPayload) =>
  api.post<CreateSchoolResponse>("/admin/schools", payload).then((response) => response.data)

export const getSchoolDetails = (tenantId: string) =>
  api.get<SchoolDetailsResponse>(`/admin/schools/${tenantId}`).then((response) => response.data)

export const updateSchoolConfig = (tenantId: string, payload: UpdateSchoolConfigPayload) =>
  api.patch<{ success: boolean }>(`/admin/schools/${tenantId}/config`, payload).then((response) => response.data)

export const getAdminMetrics = () =>
  api.get<AdminMetricsResponse>("/admin/metrics").then((response) => response.data)

export const getRevenueMetrics = () =>
  api.get<RevenueMetricsResponse>("/admin/metrics/revenue").then((response) => response.data)

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
  api.post<ImpersonationResponse>(`/admin/tenants/${tenantId}/impersonate`).then((response) => response.data)
