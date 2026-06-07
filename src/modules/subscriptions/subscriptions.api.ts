import { apiClient } from "@/shared/api/client"
import { asBoolean, asNullableString, asNumber, isRecord } from "@/shared/utils/parsers"

export type SubscriptionStatus = "active" | "expired" | "cancelled"
export type PaymentMethod = "cash" | "momo_mtn" | "momo_orange"
export type DurationMonths = number

// Libellés lisibles des méthodes de paiement, centralisés pour éviter la
// duplication entre la liste, le dossier détaillé, la page revenus et la modale.
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  momo_mtn: "MoMo MTN",
  momo_orange: "Orange Money",
  bank_transfer: "Virement bancaire",
}

export const formatPaymentMethod = (method: string | null | undefined): string =>
  method ? PAYMENT_METHOD_LABELS[method] ?? method : "-"

export type SubscriptionCreator = {
  id: string
  name: string
}

export type SubscriptionListItem = {
  parent_id: string
  full_name: string
  phone: string
  email: string | null
  created_by: string | null
  created_by_name: string | null
  latest_subscription: {
    id: string
    status: SubscriptionStatus
    starts_at: string
    ends_at: string
    created_at: string | null
    duration_months: number | null
    total_amount_fcfa: number | null
    monthly_amount_fcfa: number | null
    expires_soon: boolean
    days_remaining: number | null
    created_by: string | null
    created_by_name: string | null
  } | null
  students: Array<{ id: string; full_name: string }>
}

export type SubscriptionParentsResponse = {
  data: SubscriptionListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  schemaName: string
}

export type CreateSubscriptionPayload = {
  full_name: string
  phone: string
  email?: string
  student_ids: string[]
  duration_months: DurationMonths
  payment_method: PaymentMethod
  paid_now: boolean
}

export type CreateSubscriptionResult = {
  parent: { id: string; full_name: string; phone: string }
  subscription: { id: string; total_amount_fcfa: number; starts_at: string; ends_at: string }
  credentials: { phone: string; temp_password: string }
}

export type RenewSubscriptionPayload = {
  duration_months: DurationMonths
  payment_method: PaymentMethod
  paid_now: boolean
}

export type UpdateParentContactPayload = {
  phone: string
  email?: string | null
}

export type RevenueSummary = {
  month: string
  subscriptions_active_count: number
  subscriptions_new_this_month: number
  total_collected_fcfa: number
  monthly_revenue_prorated_fcfa: number
  commission_pct: number
  commission_due_fcfa: number
  commission_paid_fcfa: number
  commission_remaining_fcfa: number
  sms_unit_price_fcfa: number | null
}

export type RevenueHistoryItem = {
  month: string
  subscriptions_active_count: number
  subscriptions_new_this_month: number
  total_collected_fcfa: number
  monthly_revenue_prorated_fcfa: number
  commission_due_fcfa: number
  commission_paid_fcfa: number
  commission_remaining_fcfa: number
  payment_status: "paid" | "partial" | "pending"
}
export type RevenuePaymentItem = {
  id: string
  period_month: string
  amount_fcfa: number
  notes: string | null
  created_at: string
  payment_method: string | null
}

export type RevenueSubscriptionDetailItem = {
  payment_id: string
  parent_id: string
  full_name: string
  phone: string
  subscription_id: string
  paid_at: string
  amount_fcfa: number
  payment_method: string
  duration_months: number
  starts_at: string
  ends_at: string
  students_count: number
}

export type SubscriptionClassItem = {
  id: string
  name: string
  students_count: number
}

export type SubscriptionClassStudentItem = {
  id: string
  full_name: string
  class_id: string
  class_name: string
  registration_number: string | null
}

export type SubscriptionClassStudentsResponse = {
  data: SubscriptionClassStudentItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type SmsFeatureSettings = {
  is_enabled: boolean
  monetize_parent_alerts: boolean
  commission_pct: number
  sms_unit_price_fcfa: number | null
}

const parseApiError = (error: unknown, fallback: string): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === "string"
  ) {
    return (error as { response: { data: { error: string } } }).response.data.error
  }
  return fallback
}

export const listSubscriptionParents = async (params: {
  page?: number
  limit?: number
  search?: string
  status?: SubscriptionStatus
  month?: string
  created_by?: string
}): Promise<SubscriptionParentsResponse> => {
  const response = await apiClient.get<SubscriptionParentsResponse>("/subscriptions/parents", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 100,
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.month ? { month: params.month } : {}),
      ...(params.created_by ? { created_by: params.created_by } : {}),
    },
  })
  return response.data
}

export const listSubscriptionCreators = async (): Promise<SubscriptionCreator[]> => {
  const response = await apiClient.get<{ data: SubscriptionCreator[] }>("/subscriptions/creators")
  return response.data.data
}

export const listSubscriptionClasses = async (params?: {
  search?: string
}): Promise<SubscriptionClassItem[]> => {
  const response = await apiClient.get<{ data: SubscriptionClassItem[] }>("/subscriptions/classes", {
    params: params?.search ? { search: params.search } : undefined,
  })
  return response.data.data
}

export const listSubscriptionClassStudents = async (params: {
  class_id: string
  page?: number
  limit?: number
  search?: string
}): Promise<SubscriptionClassStudentsResponse> => {
  const response = await apiClient.get<SubscriptionClassStudentsResponse>("/subscriptions/students", {
    params: {
      class_id: params.class_id,
      page: params.page ?? 1,
      limit: params.limit ?? 25,
      ...(params.search ? { search: params.search } : {}),
    },
  })
  return response.data
}

export const createSubscriptionParent = async (
  payload: CreateSubscriptionPayload
): Promise<CreateSubscriptionResult> => {
  try {
    const response = await apiClient.post<CreateSubscriptionResult>("/subscriptions/parents", payload)
    return response.data
  } catch (error) {
    throw new Error(parseApiError(error, "Impossible de créer l'abonnement."))
  }
}

export const renewSubscriptionParent = async (
  parentId: string,
  payload: RenewSubscriptionPayload
): Promise<void> => {
  try {
    await apiClient.post(`/subscriptions/parents/${parentId}/renew`, payload)
  } catch (error) {
    throw new Error(parseApiError(error, "Impossible de renouveler l'abonnement."))
  }
}

export const updateParentSubscriptionContact = async (
  parentId: string,
  payload: UpdateParentContactPayload
): Promise<void> => {
  try {
    await apiClient.patch(`/subscriptions/parents/${parentId}/contact`, {
      phone: payload.phone,
      email: payload.email?.trim() ? payload.email.trim() : null,
    })
  } catch (error) {
    throw new Error(parseApiError(error, "Impossible de modifier le contact parent."))
  }
}

export const cancelSubscription = async (
  parentId: string,
  subscriptionId: string,
  reason?: string
): Promise<void> => {
  try {
    await apiClient.patch(`/subscriptions/parents/${parentId}/subscription/${subscriptionId}/cancel`, {
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    })
  } catch (error) {
    throw new Error(parseApiError(error, "Impossible d'annuler l'abonnement."))
  }
}

export const resetParentSubscriptionPassword = async (
  parentId: string
): Promise<{ phone: string; new_temp_password: string }> => {
  try {
    const response = await apiClient.post<{ phone: string; new_temp_password: string }>(
      `/subscriptions/parents/${parentId}/reset-password`
    )
    return response.data
  } catch (error) {
    throw new Error(parseApiError(error, "Impossible de réinitialiser le mot de passe."))
  }
}

export const getParentSubscriptionDetails = async (parentId: string) => {
  const response = await apiClient.get<{
    parent: {
      id: string
      full_name: string
      phone: string
      email: string | null
      is_active: boolean
      created_at: string
    }
    subscriptions: Array<{
      id: string
      status: SubscriptionStatus
      unit_price_fcfa: number
      student_count: number
      total_amount_fcfa: number
      duration_months: number
      starts_at: string
      ends_at: string
      auto_renew_alert: boolean
      renewed_count: number
      created_at: string
      cancelled_at: string | null
      cancelled_by_name: string | null
      created_by_name: string | null
      students: Array<{ id: string; full_name: string; class_name: string | null; registration_number: string | null }>
      payments: Array<{
        id: string
        amount_fcfa: number
        payment_method: string
        paid_at: string
        created_at: string
        notes: string | null
      }>
    }>
  }>(`/subscriptions/parents/${parentId}`)
  return response.data
}

export const getSubscriptionsRevenueSummary = async (month: string): Promise<RevenueSummary> => {
  const response = await apiClient.get<RevenueSummary>("/subscriptions/revenue/summary", {
    params: { month },
  })
  return response.data
}

export const getSubscriptionsRevenueHistory = async (months = 12): Promise<RevenueHistoryItem[]> => {
  const response = await apiClient.get<{ months: RevenueHistoryItem[] }>("/subscriptions/revenue/history", {
    params: { months },
  })
  return response.data.months
}

/**
 * Lance la génération du bilan PDF des reversements sur une période (job
 * asynchrone). Remplace l'ancienne impression HTML navigateur ; le frontend
 * poll ensuite /jobs/:id/status puis télécharge le PDF brandé.
 */
export const exportSubscriptionsRevenue = async (input: {
  periodFrom: string
  periodTo: string
}): Promise<{ jobId: string }> => {
  const response = await apiClient.post("/subscriptions/revenue/export", {
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
  })
  const payload = (response.data ?? {}) as { jobId?: string | number }
  return { jobId: String(payload.jobId ?? "") }
}

export const getSubscriptionsRevenuePayments = async (month: string): Promise<RevenuePaymentItem[]> => {
  const response = await apiClient.get<{ data: RevenuePaymentItem[] }>("/subscriptions/revenue/payments", {
    params: { month },
  })
  return response.data.data
}

export const getSubscriptionsRevenueDetails = async (month: string): Promise<RevenueSubscriptionDetailItem[]> => {
  const response = await apiClient.get<{ data: RevenueSubscriptionDetailItem[] }>("/subscriptions/revenue/subscriptions", {
    params: { month },
  })
  return response.data.data
}

export const getSmsFeatureSettings = async (): Promise<SmsFeatureSettings> => {
  const response = await apiClient.get<SmsFeatureSettings>("/settings/sms-price")
  return response.data
}

export const updateSmsUnitPrice = async (sms_unit_price_fcfa: number): Promise<SmsFeatureSettings> => {
  const response = await apiClient.patch<SmsFeatureSettings>("/settings/sms-price", {
    sms_unit_price_fcfa,
  })
  return response.data
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUBSCRIPTIONS REVENUE STATS (KPI CARDS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type OverdueMonth = {
  month: string
  amount: number
  dueDate: string
  daysPastDue: number
}

export type SubscriptionsRevenueStatsResponse = {
  collectedAmount: number
  activeSubscribers: number
  newSubscribers: number
  collectionRate: number
  expectedAmount: number
  schoolGain: number
  edutrackCommission: number
  commissionPaid: number
  commissionRate: number
  remainingToReverse: number
  nextReverseDate: string | null
  isReverseOverdue: boolean
  overdueMonths: OverdueMonth[]
}

const normalizeOverdueMonth = (payload: unknown): OverdueMonth => {
  const data = isRecord(payload) ? payload : {}

  return {
    month: typeof data.month === "string" ? data.month : "",
    amount: asNumber(data.amount, 0),
    dueDate: typeof data.dueDate === "string" ? data.dueDate : "",
    daysPastDue: asNumber(data.daysPastDue, 0),
  }
}

const normalizeSubscriptionsRevenueStats = (payload: unknown): SubscriptionsRevenueStatsResponse => {
  const data = isRecord(payload) ? payload : {}

  return {
    collectedAmount: asNumber(data.total_collected_fcfa, asNumber(data.collectedAmount, 0)),
    activeSubscribers: asNumber(data.subscriptions_active_count, asNumber(data.activeSubscribers, 0)),
    newSubscribers: asNumber(data.subscriptions_new_this_month, asNumber(data.newSubscribers, 0)),
    collectionRate: asNumber(data.collectionRate, 0),
    expectedAmount: asNumber(data.expectedAmount, 0),
    schoolGain: Math.max(
      0,
      asNumber(data.total_collected_fcfa, asNumber(data.collectedAmount, 0)) -
        asNumber(data.commission_due_fcfa, asNumber(data.edutrackCommission, 0))
    ),
    edutrackCommission: asNumber(data.commission_due_fcfa, asNumber(data.edutrackCommission, 0)),
    commissionPaid: asNumber(data.commission_paid_fcfa, asNumber(data.commissionPaid, 0)),
    commissionRate: asNumber(data.commission_pct, asNumber(data.commissionRate, 0)),
    remainingToReverse: asNumber(data.commission_remaining_fcfa, asNumber(data.remainingToReverse, 0)),
    nextReverseDate: asNullableString(data.nextReverseDate),
    isReverseOverdue: asBoolean(data.isReverseOverdue, false),
    overdueMonths: Array.isArray(data.overdueMonths) ? data.overdueMonths.map(normalizeOverdueMonth) : [],
  }
}

export const getSubscriptionsRevenueStats = async (month?: string): Promise<SubscriptionsRevenueStatsResponse> => {
  const response = await apiClient.get("/subscriptions/revenue/summary", {
    params: month ? { month } : undefined,
  })
  return normalizeSubscriptionsRevenueStats(response.data)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMISSION OVERDUE ALERTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type CommissionOverdueMonth = {
  month: string
  remainingFcfa: number
  collectedFcfa: number
  paymentStatus: "paid" | "partial" | "pending"
}

export type CommissionOverdueAlertsResponse = {
  count: number
  totalRemainingFcfa: number
  months: CommissionOverdueMonth[]
}

const normalizeCommissionOverdueAlerts = (payload: unknown): CommissionOverdueAlertsResponse => {
  const data = isRecord(payload) ? payload : {}
  const months = Array.isArray(data.months)
    ? data.months.map((m: unknown) => {
        const item = isRecord(m) ? m : {}
        return {
          month: typeof item.month === "string" ? item.month : "",
          remainingFcfa: asNumber(item.remainingFcfa, 0),
          collectedFcfa: asNumber(item.collectedFcfa, 0),
          paymentStatus: (item.paymentStatus === "paid" || item.paymentStatus === "partial" ? item.paymentStatus : "pending") as CommissionOverdueMonth["paymentStatus"],
        }
      })
    : []
  return {
    count: asNumber(data.count, 0),
    totalRemainingFcfa: asNumber(data.totalRemainingFcfa, 0),
    months,
  }
}

export const getCommissionOverdueAlerts = async (): Promise<CommissionOverdueAlertsResponse> => {
  const response = await apiClient.get("/subscriptions/revenue/commission/overdue-alerts")
  return normalizeCommissionOverdueAlerts(response.data)
}
