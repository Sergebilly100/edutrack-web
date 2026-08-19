import { apiClient } from "@/shared/api/client"
import { asBoolean, asNullableString, asNumber, asString, isRecord } from "@/shared/utils/parsers"

export type PaymentMethod = "mobile_money" | "cash" | "bank_transfer"
export type PaymentStatus = "confirmed" | "waived_by_school" | "cancelled"
export type PaymentProvider = "orange_money" | "mtn_momo" | "moov_money" | "wave"
export type SubscriptionPeriod = "monthly" | "quarterly" | "semester" | "annual"

export type FinancialStatus = {
  studentId: string
  schoolYearId: string
  asOfDate: string
  currency: string
  totalDue: number
  confirmedPaid: number
  remainingDue: number
  cumulativeExpectedAtDate: number
  standing: "up_to_date" | "late"
}

export type Payment = {
  id: string
  studentId: string
  schoolYearId: string
  amount: number
  method: PaymentMethod
  source: "in_app_button" | "cashier_manual" | "bulk_import" | "migration_import"
  status: PaymentStatus
  providerReference: string | null
  schoolReceiptReference: string | null
  receiptNumber: string
  cancelledAt: string | null
  cancellationReason: string | null
  createdAt: string
}

export type TuitionScheduleStep = {
  id?: string
  dueDate: string
  cumulativeAmountExpected: number
}

export type TuitionPlan = {
  id: string
  levelId: string
  levelName: string
  schoolYearId: string
  schoolYearLabel: string
  totalAmount: number
  currency: string
  scheduleSteps: TuitionScheduleStep[]
}

export type ProviderSetting = {
  id: string
  provider: PaymentProvider
  merchantNumber: string
  isActive: boolean
  hasCredentials: boolean
}

export type SubscriptionPlan = {
  id: string
  amount: number
  period: SubscriptionPeriod
  label: string
  isMandatoryAtEnrollment: boolean
  imposedDuration: SubscriptionPeriod | null
  showOnReceiptAsSeparateLine: boolean
}

export type PaymentOptions = {
  inAppPaymentActive: false
  disabledReason: "temporarily_disabled"
  manualPaymentChannels: Array<{ provider: PaymentProvider; merchantNumber: string }>
}

const record = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {}

const parseFinancialStatus = (value: unknown): FinancialStatus => {
  const row = record(value)
  return {
    studentId: asString(row.studentId),
    schoolYearId: asString(row.schoolYearId),
    asOfDate: asString(row.asOfDate),
    currency: asString(row.currency, "FCFA"),
    totalDue: asNumber(row.totalDue),
    confirmedPaid: asNumber(row.confirmedPaid),
    remainingDue: asNumber(row.remainingDue),
    cumulativeExpectedAtDate: asNumber(row.cumulativeExpectedAtDate),
    standing: row.standing === "late" ? "late" : "up_to_date",
  }
}

const parsePayment = (value: unknown): Payment => {
  const row = record(value)
  const method = row.method === "mobile_money" || row.method === "bank_transfer" ? row.method : "cash"
  const status = row.status === "cancelled" || row.status === "waived_by_school" ? row.status : "confirmed"
  const source = row.source === "in_app_button" || row.source === "bulk_import" || row.source === "migration_import"
    ? row.source
    : "cashier_manual"
  return {
    id: asString(row.id),
    studentId: asString(row.studentId),
    schoolYearId: asString(row.schoolYearId),
    amount: asNumber(row.amount),
    method,
    source,
    status,
    providerReference: asNullableString(row.providerReference),
    schoolReceiptReference: asNullableString(row.schoolReceiptReference),
    receiptNumber: asString(row.receiptNumber),
    cancelledAt: asNullableString(row.cancelledAt),
    cancellationReason: asNullableString(row.cancellationReason),
    createdAt: asString(row.createdAt),
  }
}

const parseTuitionPlan = (value: unknown): TuitionPlan => {
  const row = record(value)
  const rawSteps = Array.isArray(row.schedule_steps) ? row.schedule_steps : []
  return {
    id: asString(row.id),
    levelId: asString(row.level_id),
    levelName: asString(row.level_name),
    schoolYearId: asString(row.school_year_id),
    schoolYearLabel: asString(row.school_year_label),
    totalAmount: asNumber(row.total_amount),
    currency: asString(row.currency, "FCFA"),
    scheduleSteps: rawSteps.map((step) => {
      const item = record(step)
      return {
        id: asString(item.id) || undefined,
        dueDate: asString(item.dueDate),
        cumulativeAmountExpected: asNumber(item.cumulativeAmountExpected),
      }
    }),
  }
}

const parseProviderSetting = (value: unknown): ProviderSetting => {
  const row = record(value)
  const provider = row.provider === "mtn_momo" || row.provider === "moov_money" || row.provider === "wave"
    ? row.provider
    : "orange_money"
  return {
    id: asString(row.id),
    provider,
    merchantNumber: asString(row.merchant_number),
    isActive: asBoolean(row.is_active),
    hasCredentials: asBoolean(row.has_credentials),
  }
}

const parseSubscriptionPlan = (value: unknown): SubscriptionPlan => {
  const row = record(value)
  const period = row.period === "quarterly" || row.period === "semester" || row.period === "annual"
    ? row.period
    : "monthly"
  const imposedDuration = row.imposed_duration === "monthly" || row.imposed_duration === "quarterly" || row.imposed_duration === "semester" || row.imposed_duration === "annual"
    ? row.imposed_duration
    : null
  return {
    id: asString(row.id),
    amount: asNumber(row.amount),
    period,
    label: asString(row.label),
    isMandatoryAtEnrollment: asBoolean(row.is_mandatory_at_enrollment),
    imposedDuration,
    showOnReceiptAsSeparateLine: asBoolean(row.show_on_receipt_as_separate_line),
  }
}

export async function getFinancialStatus(studentId: string, schoolYearId: string): Promise<FinancialStatus> {
  const response = await apiClient.get(`/students/${studentId}/financial-status`, { params: { school_year_id: schoolYearId } })
  return parseFinancialStatus(response.data.financialStatus)
}

export async function listPayments(studentId: string, schoolYearId: string): Promise<Payment[]> {
  const response = await apiClient.get(`/students/${studentId}/payments`, { params: { school_year_id: schoolYearId } })
  return (Array.isArray(response.data.payments) ? response.data.payments : []).map(parsePayment)
}

export async function recordPayment(payload: {
  studentId: string
  schoolYearId: string
  amount: number
  method: PaymentMethod
  providerReference?: string
  schoolReceiptReference?: string
}): Promise<{ payment: Payment; financialStatus: FinancialStatus; receiptJobId?: string }> {
  const response = await apiClient.post("/payments", payload)
  return {
    payment: parsePayment(response.data.payment),
    financialStatus: parseFinancialStatus(response.data.financialStatus),
    receiptJobId: response.data.receiptJobId ? String(response.data.receiptJobId) : undefined,
  }
}

export async function cancelPayment(id: string, reason: string): Promise<void> {
  await apiClient.post(`/payments/${id}/cancel`, { reason })
}

export async function requestPaymentReceipt(id: string): Promise<{ jobId: string }> {
  const response = await apiClient.post(`/payments/${id}/receipt`)
  return { jobId: String(response.data.jobId) }
}

export async function listTuitionPlans(schoolYearId: string): Promise<TuitionPlan[]> {
  const response = await apiClient.get("/tuition-plans", { params: { school_year_id: schoolYearId } })
  return (Array.isArray(response.data.tuitionPlans) ? response.data.tuitionPlans : []).map(parseTuitionPlan)
}

export async function upsertTuitionPlan(levelId: string, payload: {
  schoolYearId: string
  totalAmount: number
  currency: string
  scheduleSteps: Array<{ dueDate: string; cumulativeAmountExpected: number }>
}): Promise<TuitionPlan> {
  const response = await apiClient.put(`/tuition-plans/levels/${levelId}`, payload)
  return parseTuitionPlan(response.data.tuitionPlan)
}

export async function grantTuitionOverride(payload: {
  studentId: string
  schoolYearId: string
  overrideTotalAmount?: number
  discountAmount?: number
  reason: string
}): Promise<void> {
  await apiClient.post("/tuition/overrides", payload)
}

export async function listProviderSettings(): Promise<ProviderSetting[]> {
  const response = await apiClient.get("/payment-provider-settings")
  return (Array.isArray(response.data.settings) ? response.data.settings : []).map(parseProviderSetting)
}

export async function saveProviderSetting(payload: {
  provider: PaymentProvider
  merchantNumber: string
  apiCredentials: Record<string, unknown>
}): Promise<void> {
  await apiClient.put("/payment-provider-settings", { ...payload, isActive: false })
}

export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const response = await apiClient.get("/subscription-plans")
  return (Array.isArray(response.data.subscriptionPlans) ? response.data.subscriptionPlans : []).map(parseSubscriptionPlan)
}

export async function saveSubscriptionPlan(payload: Omit<SubscriptionPlan, "id">, id?: string): Promise<void> {
  const body = {
    amount: payload.amount,
    period: payload.period,
    label: payload.label,
    isMandatoryAtEnrollment: payload.isMandatoryAtEnrollment,
    imposedDuration: payload.imposedDuration,
    showOnReceiptAsSeparateLine: payload.showOnReceiptAsSeparateLine,
  }
  if (id) {
    await apiClient.put(`/subscription-plans/${id}`, body)
  } else {
    await apiClient.post("/subscription-plans", body)
  }
}

export async function getParentFinancialStatus(studentId: string, schoolYearId: string): Promise<FinancialStatus> {
  const response = await apiClient.get(`/parent/students/${studentId}/financial-status`, { params: { school_year_id: schoolYearId } })
  return parseFinancialStatus(response.data.financialStatus)
}

export async function listParentPayments(studentId: string, schoolYearId: string): Promise<Payment[]> {
  const response = await apiClient.get(`/parent/students/${studentId}/payments`, { params: { school_year_id: schoolYearId } })
  return (Array.isArray(response.data.payments) ? response.data.payments : []).map(parsePayment)
}

export async function getParentPaymentOptions(): Promise<PaymentOptions> {
  const response = await apiClient.get("/parent/payment-options")
  const channels = Array.isArray(response.data.manualPaymentChannels) ? response.data.manualPaymentChannels : []
  return {
    inAppPaymentActive: false,
    disabledReason: "temporarily_disabled",
    manualPaymentChannels: channels.map((value: unknown) => {
      const row = record(value)
      const provider = row.provider === "mtn_momo" || row.provider === "moov_money" || row.provider === "wave"
        ? row.provider
        : "orange_money"
      return { provider, merchantNumber: asString(row.merchant_number) }
    }),
  }
}

export async function requestParentPaymentReceipt(studentId: string, paymentId: string): Promise<{ jobId: string }> {
  const response = await apiClient.post(`/parent/students/${studentId}/payments/${paymentId}/receipt`)
  return { jobId: String(response.data.jobId) }
}
