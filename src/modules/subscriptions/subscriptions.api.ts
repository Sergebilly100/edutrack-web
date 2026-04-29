import { apiClient } from "@/shared/api/client"

export type SubscriptionStatus = "active" | "expired" | "cancelled"
export type PaymentMethod = "cash" | "momo_mtn" | "momo_orange"
export type DurationMonths = 1 | 2 | 3

export type SubscriptionListItem = {
  parent_id: string
  full_name: string
  phone: string
  email: string | null
  latest_subscription: {
    id: string
    status: SubscriptionStatus
    starts_at: string
    ends_at: string
    monthly_amount_fcfa: number | null
    expires_soon: boolean
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
  total_collected_fcfa: number
  monthly_revenue_prorated_fcfa: number
  commission_due_fcfa: number
  commission_paid_fcfa: number
}

export type SmsFeatureSettings = {
  is_enabled: boolean
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
}): Promise<SubscriptionParentsResponse> => {
  const response = await apiClient.get<SubscriptionParentsResponse>("/subscriptions/parents", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 100,
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
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

export const resetParentSubscriptionPassword = async (parentId: string): Promise<{ new_temp_password: string }> => {
  try {
    const response = await apiClient.post<{ new_temp_password: string }>(
      `/subscriptions/parents/${parentId}/reset-password`
    )
    return response.data
  } catch (error) {
    throw new Error(parseApiError(error, "Impossible de réinitialiser le mot de passe."))
  }
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

export const recordCommissionPayment = async (payload: {
  period_month: string
  amount_fcfa: number
  notes?: string
  idempotency_key: string
}): Promise<void> => {
  try {
    await apiClient.post("/subscriptions/revenue/commission/record-payment", payload)
  } catch (error) {
    throw new Error(parseApiError(error, "Impossible d'enregistrer le versement."))
  }
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
