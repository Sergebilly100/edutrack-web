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
  active_school_year: string
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
    maxUsers: number
    maxSmsPerMonth: number
    studentLabel: string | null
    directorTitle: string | null
    canEditSmsTemplate: boolean
    canExportData: boolean
    activeSchoolYear: string | null
    logoUrl: string | null
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
    nextDueDate: string | null
    lastConnection: string | null
  }
  connectionHistory30d: Array<{
    date: string
    uniqueUsers: number
  }>
}

export type UpdateSchoolConfigPayload = {
  max_admin_positions?: number
  max_users?: number
  max_sms_per_month?: number
  city?: string
  teaching_type?: TeachingType
  student_label?: string
  director_title?: string
  can_edit_sms_template?: boolean
  can_export_data?: boolean
  active_school_year?: string
  logo_url?: string | null
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

export type RevenueSummaryResponse = {
  cards: {
    mrrTotalFcfa: number
    arrFcfa: number
    newSubscriptionsThisMonth: number
    churnThisMonth: number
  }
  monthly: Array<{
    month: string
    mrr_fcfa: number
    new_fcfa: number
    churn_fcfa: number
  }>
  schools: Array<{
    tenantId: string
    school: string
    plan: TenantPlan
    status: TenantStatus
    amountPerMonth: number
    lastDueDate: string | null
    paymentMode: string | null
  }>
}

export type SmsTemplateType =
  | "teacher_absent_director"
  | "student_absent_parent"
  | "payment_reminder"
  | "teacher_late_director"
  | "custom"

export type SmsTemplateItem = {
  id: string
  tenantId: string | null
  type: SmsTemplateType
  messageTemplate: string
  variables: string[]
  updatedAt: string
}

export type SmsDashboardResponse = {
  sentThisMonth: number
  deliveryRate: number
  activeSchools: number
  estimatedCostFcfa: number
  bySchool: Array<{
    tenantId: string
    school: string
    sent: number
    quota: number
    usedPct: number
  }>
  history: Array<{
    id: string
    date: string
    school: string
    type: string
    recipientMasked: string
    status: string
    message: string
  }>
}

export type SchoolPaymentItem = {
  id: string
  date: string
  amountFcfa: number
  provider: string
  reference: string | null
  status: string
}

export type AddSchoolPaymentPayload = {
  date: string
  amount_fcfa: number
  provider: "manual" | "mtn_momo" | "orange_money"
  reference?: string
  period_from?: string
  period_to?: string
}

export type MaintenanceConfigResponse = {
  maintenanceMode: boolean
  maintenanceMessage: string
  updatedAt: string
}

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

export const getRevenueSummary = () =>
  api.get<RevenueSummaryResponse>("/admin/revenue/summary").then((response) => response.data)

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

export const getSchoolPayments = (tenantId: string) =>
  api
    .get<{ items: SchoolPaymentItem[] }>(`/admin/schools/${tenantId}/payments`)
    .then((response) => response.data.items)

export const addSchoolPayment = (tenantId: string, payload: AddSchoolPaymentPayload) =>
  api.post<{ success: boolean }>(`/admin/schools/${tenantId}/payments`, payload).then((response) => response.data)

export const getSmsDashboard = () =>
  api.get<SmsDashboardResponse>("/admin/sms/dashboard").then((response) => response.data)

export const getGlobalSmsTemplates = () =>
  api.get<{ items: SmsTemplateItem[] }>("/admin/sms/templates").then((response) => response.data.items)

export const updateGlobalSmsTemplate = (type: SmsTemplateType, payload: { message_template: string; variables: string[] }) =>
  api.put<{ success: boolean }>(`/admin/sms/templates/${type}`, payload).then((response) => response.data)

export const getTenantSmsTemplates = (tenantId: string) =>
  api.get<{ items: SmsTemplateItem[] }>(`/admin/sms/templates/${tenantId}`).then((response) => response.data.items)

export const updateTenantSmsTemplate = (
  tenantId: string,
  type: SmsTemplateType,
  payload: { message_template: string; variables: string[] }
) => api.put<{ success: boolean }>(`/admin/sms/templates/${tenantId}/${type}`, payload).then((response) => response.data)

export const resetTenantSmsTemplate = (tenantId: string, type: SmsTemplateType) =>
  api.delete<{ success: boolean }>(`/admin/sms/templates/${tenantId}/${type}`).then((response) => response.data)

export const getMaintenanceConfig = () =>
  api.get<MaintenanceConfigResponse>("/admin/maintenance").then((response) => response.data)

export const updateMaintenanceConfig = (payload: { maintenance_mode: boolean; maintenance_message: string }) =>
  api.patch<{ success: boolean }>("/admin/maintenance", payload).then((response) => response.data)

export const clearAdminCache = () =>
  api.delete<{ success: boolean }>("/admin/cache").then((response) => response.data)
