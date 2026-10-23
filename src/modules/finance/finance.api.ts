import { apiClient } from "@/shared/api/client"
import { triggerBlobDownload } from "@/shared/api/pdfExport.api"
import { asBoolean, asNullableString, asNumber, asString, isRecord } from "@/shared/utils/parsers"

export type PaymentMethod = "mobile_money" | "cash" | "bank_transfer"
export type PaymentStatus = "confirmed" | "cancelled"
export type PaymentProvider = "orange_money" | "mtn_momo" | "moov_money" | "wave"
export type SubscriptionPeriod = "monthly" | "quarterly" | "semester" | "annual"

export type FinancialStatus = {
  studentId: string
  schoolYearId: string
  asOfDate: string
  currency: string
  totalDue: number
  discountAmount: number
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
  paymentDate: string
  createdAt: string
}

export type StudentAccountStatement = {
  student: { id: string; name: string; matricule: string | null; classId: string; className: string }
  schoolYearId: string
  currency: string
  totalDue: number
  movements: Array<Payment & { runningPaid: number; balanceAfter: number }>
}

export type CashJournalFilter = {
  schoolYearId?: string
  from?: string
  to?: string
  classId?: string
  method?: PaymentMethod
}

export type CashJournalPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type CashJournal = {
  entries: Array<Payment & { studentMatricule: string | null; studentName: string; classId: string; className: string }>
  totals: Record<PaymentMethod, number> & { grandTotal: number }
  count: number
  pagination: CashJournalPagination
}

export type FinancialCacheStatus = "up_to_date" | "late"

export type PaymentHistoryFilter = {
  schoolYearId: string
  from?: string
  to?: string
  levelId?: string
  classId?: string
  status?: FinancialCacheStatus
  page?: number
  limit?: number
}

export type PaymentHistory = {
  entries: Array<Payment & {
    studentMatricule: string | null
    studentName: string
    classId: string
    className: string
    levelId: string
    levelName: string
    financialStatus: FinancialCacheStatus | null
  }>
  pagination: CashJournalPagination
}

export type PaymentMappingField = {
  id?: string
  sourceColumnLabel: string
  targetField: "matricule" | "montant" | "date" | "reference" | "method"
  isRequired: boolean
  translations: Array<{ sourceValue: string; targetValue: PaymentMethod }>
}

export type PaymentMappingProfile = {
  id: string
  importType: string
  label: string | null
  isActive: boolean
  fields: PaymentMappingField[]
}

export type PaymentImportAnalysis = {
  headers: string[]
  rowCount: number
  sampleRows: Array<{ rowNumber: number; values: Record<string, string | number> }>
  profile: PaymentMappingProfile | null
  matchedFields: PaymentMappingField[]
  unmatchedHeaders: string[]
  missingRequiredTargets: string[]
  distinctValuesByColumn: Record<string, string[]>
}

export type PaymentImportPreview = {
  schoolYearId: string
  validRows: Array<{ rowNumber: number; matricule: string; studentName: string; className: string; amount: number; paymentDate: string; reference: string; method: PaymentMethod }>
  errors: Array<{ rowNumber: number; reason: string }>
  totalRows: number
}

export type TuitionScheduleStep = {
  id?: string
  dueDate: string
  cumulativeAmountExpected: number
}

export type NegotiatedTuitionScheduleAgreement = {
  id: string
  studentId: string
  schoolYearId: string
  reason: string
  createdByUserId: string | null
  updatedByUserId: string | null
  updatedByName: string | null
  createdAt: string
  updatedAt: string
  scheduleSteps: TuitionScheduleStep[]
}

export type StudentTuitionSchedule = {
  agreement: NegotiatedTuitionScheduleAgreement | null
  totalTuitionAmount: number
  confirmedPaid: number
  remainingToPlan: number
  currency: string
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
    discountAmount: asNumber(row.discountAmount),
    confirmedPaid: asNumber(row.confirmedPaid),
    remainingDue: asNumber(row.remainingDue),
    cumulativeExpectedAtDate: asNumber(row.cumulativeExpectedAtDate),
    standing: row.standing === "late" ? "late" : "up_to_date",
  }
}

const parsePayment = (value: unknown): Payment => {
  const row = record(value)
  const method = row.method === "mobile_money" || row.method === "bank_transfer" ? row.method : "cash"
  const status = row.status === "cancelled" ? row.status : "confirmed"
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
    paymentDate: asString(row.paymentDate ?? row.payment_date ?? row.createdAt ?? row.created_at).slice(0, 10),
    createdAt: asString(row.createdAt),
  }
}

const journalParams = (filter: CashJournalFilter & Partial<Pick<CashJournalPagination, "page" | "limit">>) => ({
  school_year_id: filter.schoolYearId,
  from: filter.from,
  to: filter.to,
  class_id: filter.classId,
  method: filter.method,
  page: filter.page,
  limit: filter.limit,
})

const parseStatement = (value: unknown): StudentAccountStatement => {
  const row = record(value)
  const student = record(row.student)
  return {
    student: { id: asString(student.id), name: asString(student.name), matricule: asNullableString(student.matricule), classId: asString(student.classId), className: asString(student.className) },
    schoolYearId: asString(row.schoolYearId),
    currency: asString(row.currency, "FCFA"),
    totalDue: asNumber(row.totalDue),
    movements: (Array.isArray(row.movements) ? row.movements : []).map((item) => {
      const movement = record(item)
      return { ...parsePayment(item), runningPaid: asNumber(movement.runningPaid), balanceAfter: asNumber(movement.balanceAfter) }
    }),
  }
}

export async function getStudentAccountStatement(studentId: string, schoolYearId: string): Promise<StudentAccountStatement> {
  const response = await apiClient.get(`/students/${studentId}/account-statement`, { params: { school_year_id: schoolYearId } })
  return parseStatement(response.data.statement)
}

export async function getParentAccountStatement(studentId: string, schoolYearId: string): Promise<StudentAccountStatement> {
  const response = await apiClient.get(`/parent/students/${studentId}/account-statement`, { params: { school_year_id: schoolYearId } })
  return parseStatement(response.data.statement)
}

export async function getCashJournal(filter: CashJournalFilter & Partial<Pick<CashJournalPagination, "page" | "limit">>): Promise<CashJournal> {
  const response = await apiClient.get("/payments/cash-journal", { params: journalParams(filter) })
  const journal = record(response.data.journal)
  const totals = record(journal.totals)
  const pagination = record(journal.pagination)
  return {
    entries: (Array.isArray(journal.entries) ? journal.entries : []).map((item) => {
      const row = record(item)
      return { ...parsePayment(item), studentMatricule: asNullableString(row.studentMatricule), studentName: asString(row.studentName), classId: asString(row.classId), className: asString(row.className) }
    }),
    totals: { cash: asNumber(totals.cash), mobile_money: asNumber(totals.mobile_money), bank_transfer: asNumber(totals.bank_transfer), grandTotal: asNumber(totals.grandTotal) },
    count: asNumber(journal.count),
    pagination: {
      page: asNumber(pagination.page, 1),
      limit: asNumber(pagination.limit, 20),
      total: asNumber(pagination.total),
      totalPages: asNumber(pagination.totalPages, 1),
    },
  }
}

export async function getPaymentHistory(filter: PaymentHistoryFilter): Promise<PaymentHistory> {
  const response = await apiClient.get("/finance/payment-history", {
    params: {
      school_year_id: filter.schoolYearId,
      from: filter.from,
      to: filter.to,
      level_id: filter.levelId,
      class_id: filter.classId,
      status: filter.status,
      page: filter.page,
      limit: filter.limit,
    },
  })
  const history = record(response.data.history)
  const pagination = record(history.pagination)
  return {
    entries: (Array.isArray(history.entries) ? history.entries : []).map((item) => {
      const row = record(item)
      const status = row.financialStatus === "late" ? row.financialStatus : row.financialStatus === "up_to_date" ? "up_to_date" : null
      return {
        ...parsePayment(item),
        studentMatricule: asNullableString(row.studentMatricule),
        studentName: asString(row.studentName),
        classId: asString(row.classId),
        className: asString(row.className),
        levelId: asString(row.levelId),
        levelName: asString(row.levelName),
        financialStatus: status,
      }
    }),
    pagination: {
      page: asNumber(pagination.page, 1),
      limit: asNumber(pagination.limit, 20),
      total: asNumber(pagination.total),
      totalPages: asNumber(pagination.totalPages, 1),
    },
  }
}

export async function recalculateFinancialCache(schoolYearId: string): Promise<{ schoolYearId: string; studentCount: number }> {
  const response = await apiClient.post("/finance/recalculate", undefined, { params: { school_year_id: schoolYearId } })
  const result = record(response.data.result)
  return { schoolYearId: asString(result.schoolYearId), studentCount: asNumber(result.studentCount) }
}

export async function exportCashJournalPdf(filter: CashJournalFilter): Promise<{ jobId: string }> {
  const response = await apiClient.get("/payments/cash-journal/export", { params: { ...journalParams(filter), format: "pdf" } })
  return { jobId: String(response.data.jobId) }
}

export async function exportCashJournalExcel(filter: CashJournalFilter): Promise<void> {
  const response = await apiClient.get("/payments/cash-journal/export", { params: { ...journalParams(filter), format: "xlsx" }, responseType: "blob" })
  triggerBlobDownload(response.data as Blob, "journal-caisse.xlsx")
}

const fileForm = (file: File): FormData => { const form = new FormData(); form.append("file", file); return form }

export async function analyzePaymentImport(file: File): Promise<PaymentImportAnalysis> {
  const response = await apiClient.post("/payment-import/analyze", fileForm(file))
  return response.data as PaymentImportAnalysis
}

export async function previewPaymentImport(file: File): Promise<PaymentImportPreview> {
  const response = await apiClient.post("/payment-import/preview", fileForm(file))
  return response.data as PaymentImportPreview
}

export async function confirmPaymentImport(file: File): Promise<{ createdCount: number; errors: PaymentImportPreview["errors"]; totalRows: number }> {
  const response = await apiClient.post("/payment-import/confirm", fileForm(file))
  return response.data
}

export async function getPaymentMappingProfile(): Promise<PaymentMappingProfile | null> {
  const response = await apiClient.get("/payment-import/profile")
  return response.data.profile as PaymentMappingProfile | null
}

export async function savePaymentMappingProfile(input: { label?: string; fields: PaymentMappingField[] }): Promise<PaymentMappingProfile> {
  const response = await apiClient.put("/payment-import/profile", { label: input.label, fields: input.fields.map(({ sourceColumnLabel, targetField, translations }) => ({ sourceColumnLabel, targetField, translations })) })
  return response.data.profile as PaymentMappingProfile
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

export async function replaceTuitionOverride(payload: {
  studentId: string
  schoolYearId: string
  overrideTotalAmount?: number
  discountAmount?: number
  reason: string
}): Promise<void> {
  await apiClient.put(`/tuition/overrides/${payload.studentId}`, payload)
}

export type TuitionOverrideWithdrawalPreview = { adjustment: { overrideId: string; type: "discount" | "custom_total"; discountAmount: number | null; overrideTotalAmount: number | null }; currency: string; currentTotalAmount: number; restoredTotalAmount: number; confirmedPaid: number; remainingBefore: number; remainingAfter: number; standingBefore: string; standingAfter: string; potentialOverpayment: boolean; schedule: { present: boolean; compatible: boolean } }
export async function getTuitionOverrideWithdrawalPreview(studentId: string, schoolYearId: string): Promise<TuitionOverrideWithdrawalPreview> {
  const response = await apiClient.get(`/tuition/overrides/${studentId}/withdrawal-preview`, { params: { school_year_id: schoolYearId } })
  const data = record(response.data)
  return { adjustment: record(data.adjustment) as TuitionOverrideWithdrawalPreview["adjustment"], currency: asString(data.currency, "FCFA"), currentTotalAmount: asNumber(data.currentTotalAmount), restoredTotalAmount: asNumber(data.restoredTotalAmount), confirmedPaid: asNumber(data.confirmedPaid), remainingBefore: asNumber(data.remainingBefore), remainingAfter: asNumber(data.remainingAfter), standingBefore: asString(data.standingBefore), standingAfter: asString(data.standingAfter), potentialOverpayment: asBoolean(data.potentialOverpayment), schedule: record(data.schedule) as TuitionOverrideWithdrawalPreview["schedule"] }
}
export async function withdrawTuitionOverride(payload: { studentId: string; schoolYearId: string; reason: string; scheduleResolution: "keep" | "reset" }): Promise<void> {
  await apiClient.post(`/tuition/overrides/${payload.studentId}/withdraw`, { schoolYearId: payload.schoolYearId, reason: payload.reason, scheduleResolution: payload.scheduleResolution })
}

export type AgreementStatus = "active" | "withdrawn" | "replaced" | "reset"
export type AgreementRegisterEntry = { id: string; kind: "override" | "schedule"; status: AgreementStatus; student_id: string; school_year_id: string; student_name: string; matricule: string | null; class_name: string; level_name: string; discount_amount: number; override_total_amount: number; active_discount_amount: number; plan_total_amount: number; total_paid: number; remaining_due: number; financial_status: "late" | "up_to_date" | null; created_at: string; created_by_name: string | null; withdrawn_at: string | null; step_count: number; schedule_total_amount: number; next_due_date: string | null }
export type AgreementRegisterFilter = { schoolYearId: string; kind: "overrides" | "schedules"; search?: string; studentId?: string; classId?: string; levelId?: string; from?: string; to?: string; status?: AgreementStatus | "all"; page?: number; limit?: number }
export type AgreementAuditEvent = { id: string; action: string; actor_role: string; actor_name: string | null; created_at: string; payload_before: Record<string, unknown> | null; payload_after: Record<string, unknown> }
export type AgreementDetail = { agreement: AgreementRegisterEntry & { reason: string; withdrawal_reason: string | null; schedule_steps?: TuitionScheduleStep[] }; events: AgreementAuditEvent[] }

const parseAgreementEntry = (value: unknown): AgreementRegisterEntry => {
  const row = record(value)
  const status = row.status === "withdrawn" || row.status === "replaced" || row.status === "reset" ? row.status : "active"
  return { id: asString(row.id), kind: row.kind === "schedule" ? "schedule" : "override", status, student_id: asString(row.student_id), school_year_id: asString(row.school_year_id), student_name: asString(row.student_name), matricule: asNullableString(row.matricule), class_name: asString(row.class_name), level_name: asString(row.level_name), discount_amount: asNumber(row.discount_amount), override_total_amount: asNumber(row.override_total_amount), active_discount_amount: asNumber(row.active_discount_amount), plan_total_amount: asNumber(row.plan_total_amount), total_paid: asNumber(row.total_paid), remaining_due: asNumber(row.remaining_due), financial_status: row.financial_status === "late" ? "late" : row.financial_status === "up_to_date" ? "up_to_date" : null, created_at: asString(row.created_at), created_by_name: asNullableString(row.created_by_name), withdrawn_at: asNullableString(row.withdrawn_at), step_count: asNumber(row.step_count), schedule_total_amount: asNumber(row.schedule_total_amount), next_due_date: asNullableString(row.next_due_date) }
}

export async function listAgreementsRegister(input: AgreementRegisterFilter): Promise<{ entries: AgreementRegisterEntry[]; pagination: CashJournalPagination }> {
  const response = await apiClient.get("/finance/agreements", { params: { school_year_id: input.schoolYearId, kind: input.kind, search: input.search || undefined, student_id: input.studentId, class_id: input.classId, level_id: input.levelId, from: input.from, to: input.to, status: input.status ?? "all", page: input.page ?? 1, limit: input.limit ?? 20 } })
  const payload = record(response.data); const pagination = record(payload.pagination)
  return { entries: (Array.isArray(payload.entries) ? payload.entries : []).map(parseAgreementEntry), pagination: { page: asNumber(pagination.page, 1), limit: asNumber(pagination.limit, input.limit ?? 20), total: asNumber(pagination.total), totalPages: asNumber(pagination.totalPages, 1) } }
}

export async function getAgreementDetail(kind: "overrides" | "schedules", agreementId: string): Promise<AgreementDetail> {
  const response = await apiClient.get(`/finance/agreements/${kind}/${agreementId}`); const payload = record(response.data); const agreement = record(payload.agreement)
  return { agreement: { ...parseAgreementEntry(agreement), reason: asString(agreement.reason), withdrawal_reason: asNullableString(agreement.withdrawal_reason), schedule_steps: parseTuitionScheduleSteps(agreement.schedule_steps) }, events: (Array.isArray(payload.events) ? payload.events : []).map((event) => { const row = record(event); return { id: asString(row.id), action: asString(row.action), actor_role: asString(row.actor_role), actor_name: asNullableString(row.actor_name), created_at: asString(row.created_at), payload_before: isRecord(row.payload_before) ? row.payload_before : null, payload_after: record(row.payload_after) } }) }
}

const parseTuitionScheduleSteps = (input: unknown): TuitionScheduleStep[] =>
  Array.isArray(input) ? input.map((step) => {
    const row = isRecord(step) ? step : {}
    return {
      dueDate: asString(row.dueDate ?? row.due_date),
      cumulativeAmountExpected: asNumber(row.cumulativeAmountExpected ?? row.cumulative_amount_expected),
    }
  }) : []

const parseStudentTuitionSchedule = (input: unknown): StudentTuitionSchedule => {
  const row = record(input)
  const agreement = row.agreement === null ? null : record(row.agreement)
  return {
    agreement: agreement && Object.keys(agreement).length > 0 ? {
      id: asString(agreement.id),
      studentId: asString(agreement.studentId ?? agreement.student_id),
      schoolYearId: asString(agreement.schoolYearId ?? agreement.school_year_id),
      reason: asString(agreement.reason),
      createdByUserId: asString(agreement.createdByUserId ?? agreement.created_by_user_id) || null,
      updatedByUserId: asString(agreement.updatedByUserId ?? agreement.updated_by_user_id) || null,
      updatedByName: asString(agreement.updatedByName ?? agreement.updated_by_name) || null,
      createdAt: asString(agreement.createdAt ?? agreement.created_at),
      updatedAt: asString(agreement.updatedAt ?? agreement.updated_at),
      scheduleSteps: parseTuitionScheduleSteps(agreement.scheduleSteps ?? agreement.schedule_steps),
    } : null,
    totalTuitionAmount: asNumber(row.totalTuitionAmount ?? row.total_tuition_amount),
    confirmedPaid: asNumber(row.confirmedPaid ?? row.confirmed_paid),
    remainingToPlan: asNumber(row.remainingToPlan ?? row.remaining_to_plan),
    currency: asString(row.currency, "FCFA"),
  }
}

export async function getStudentTuitionSchedule(studentId: string, schoolYearId: string): Promise<StudentTuitionSchedule> {
  const response = await apiClient.get(`/tuition/student-schedules/${studentId}`, { params: { school_year_id: schoolYearId } })
  return parseStudentTuitionSchedule(response.data)
}

export async function saveStudentTuitionSchedule(payload: {
  studentId: string
  schoolYearId: string
  reason: string
  installments: Array<{ dueDate: string; amount: number }>
}): Promise<StudentTuitionSchedule> {
  const response = await apiClient.put(`/tuition/student-schedules/${payload.studentId}`, {
    schoolYearId: payload.schoolYearId,
    reason: payload.reason,
    installments: payload.installments,
  })
  return parseStudentTuitionSchedule(response.data)
}

export async function resetStudentTuitionSchedule(studentId: string, schoolYearId: string, reason: string): Promise<boolean> {
  const response = await apiClient.delete(`/tuition/student-schedules/${studentId}`, {
    params: { school_year_id: schoolYearId }, data: { reason },
  })
  return asBoolean(response.data.deleted)
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

// ── Dashboard financier + relances (Vague 6) ────────────────────────────────

export type SchoolFinancialSummary = {
  total_expected_to_date: string;
  total_paid: string;
  remaining_to_collect: string;
  /** Exposé par UX-09a lorsque l'agrégat annuel est déployé côté API. */
  annual_total_due: string;
  annual_remaining: string;
  upcoming_due: string;
  recovery_rate: string;
  students_up_to_date_count: number;
  students_late_count: number;
  previous_period_total_paid: string;
  last_computed_at: string;
} | null;

export type RecoveryMetrics = {
  studentCount: number; expected: number; paid: number;
  remaining: number; recoveryRate: number; studentsToFollow: number;
}

export type RecoveryClass = RecoveryMetrics & {
  classId: string; className: string; levelId: string; levelName: string;
}

export type RecoveryLevel = RecoveryMetrics & { levelId: string; levelName: string }

export type RecoverySummary = {
  schoolYearId: string; school: RecoveryMetrics; selection: RecoveryMetrics;
  levels: RecoveryLevel[]; classes: RecoveryClass[];
}

export type RecoveryStudent = {
  studentId: string; name: string; matricule: string | null;
  status: FinancialCacheStatus | null; expected: number; paid: number;
  remaining: number; daysLate: number | null;
}

export type RecoveryStudents = {
  students: RecoveryStudent[];
  pagination: CashJournalPagination;
}

export type RecoveryYear = { id: string; label: string; status: "draft" | "active" | "closed" }

export async function fetchRecoveryYears(): Promise<RecoveryYear[]> {
  const response = await apiClient.get<{ years: RecoveryYear[] }>("/finance/recovery/years")
  return response.data.years
}

export async function fetchRecoverySummary(schoolYearId: string, levelId?: string, classId?: string): Promise<RecoverySummary> {
  const response = await apiClient.get<RecoverySummary>("/finance/recovery", {
    params: { school_year_id: schoolYearId, level_id: levelId, class_id: classId },
  })
  return response.data
}

export async function fetchRecoveryStudents(schoolYearId: string, classId: string, levelId?: string, page = 1): Promise<RecoveryStudents> {
  const response = await apiClient.get<RecoveryStudents>("/finance/recovery/class-students", {
    params: { school_year_id: schoolYearId, class_id: classId, level_id: levelId, page, limit: 20 },
  })
  return response.data
}

export type ClassFinancialSummaryRow = {
  class_id: string;
  class_name: string;
  level_id: string;
  level_name: string;
  total_expected_to_date: string;
  total_paid: string;
  remaining_to_collect: string;
  annual_total_due: string;
  annual_remaining: string;
  upcoming_due: string;
  students_up_to_date_count: number;
  students_late_count: number;
  last_computed_at: string;
};

export type LevelFinancialSummaryRow = {
  level_id: string;
  level_name: string;
  total_expected_to_date: string;
  total_paid: string;
  remaining_to_collect: string;
  annual_total_due: string;
  annual_remaining: string;
  upcoming_due: string;
  students_up_to_date_count: number;
  students_late_count: number;
  last_computed_at: string;
};

export type FinancialCollectionPoint = {
  month_key: string;
  total_paid: string;
};

export type FinancialPaymentMethodSummary = {
  method: PaymentMethod;
  total_paid: string;
  payment_count: number;
};

export type FinancialUpcomingInstallment = {
  due_date: string;
  expected_amount: string;
  student_count: number;
};

export type FinancialAgingBucket = {
  bucket: "0-30" | "31-60" | ">60";
  total_amount: string;
  student_count: number;
};

export type FinancialRecentPayment = {
  payment_id: string;
  student_id: string;
  payment_date: string;
  student_name: string;
  student_matricule: string | null;
  class_name: string | null;
  method: PaymentMethod;
  amount: string;
  receipt_number: string | null;
};
export type AgreementMetrics = { activeOverrides: number; activeDiscounts: number; activeSchedules: number; lateSchedules: number; lateScheduleRemaining: number } | null;

export const fetchFinancialSummary = async (schoolYearId?: string): Promise<{
  school: SchoolFinancialSummary;
  classes: ClassFinancialSummaryRow[];
  levels: LevelFinancialSummaryRow[];
  collections: FinancialCollectionPoint[];
  paymentMethods: FinancialPaymentMethodSummary[];
  upcomingInstallments: FinancialUpcomingInstallment[];
  installmentScheduleComplete: boolean;
  aging: FinancialAgingBucket[] | null;
  recentPayments: FinancialRecentPayment[];
  agreementMetrics: AgreementMetrics;
}> => {
  const response = await apiClient.get("/finance/financial-summary", {
    params: schoolYearId ? { school_year_id: schoolYearId } : undefined,
  });
  const payload = response.data ?? {};
  return {
    school: payload.school ?? null,
    classes: Array.isArray(payload.classes) ? payload.classes : [],
    levels: Array.isArray(payload.levels) ? payload.levels : [],
    collections: Array.isArray(payload.collections) ? payload.collections : [],
    paymentMethods: Array.isArray(payload.paymentMethods) ? payload.paymentMethods : [],
    upcomingInstallments: Array.isArray(payload.upcomingInstallments) ? payload.upcomingInstallments : [],
    installmentScheduleComplete: payload.installmentScheduleComplete === true,
    aging: Array.isArray(payload.aging) ? payload.aging : null,
    recentPayments: Array.isArray(payload.recentPayments) ? payload.recentPayments : [],
    agreementMetrics: payload.agreementMetrics ?? null,
  };
};

export type ClassStudentStatusRow = {
  student_id: string;
  full_name: string;
  matricule: string | null;
  total_expected_to_date: string;
  total_paid: string;
  total_due_year: string;
  status: "up_to_date" | "late";
  days_late: number | null;
};

export const fetchClassStudentsStatus = async (classId: string): Promise<ClassStudentStatusRow[]> => {
  const response = await apiClient.get<{ students: ClassStudentStatusRow[] }>(
    "/finance/class-students-status",
    { params: { class_id: classId } },
  );
  return response.data.students ?? [];
};

export type FinancialAlertRuleRow = {
  id?: string;
  type: "preventive" | "late" | "severe_late";
  daysOffset?: number;
  days_offset?: number;
  channel?: "sms" | "in_app" | "both";
  isActive?: boolean;
  is_active?: boolean;
};

export const fetchFinancialAlertRules = async (): Promise<FinancialAlertRuleRow[]> => {
  const response = await apiClient.get<{ rules: FinancialAlertRuleRow[] }>("/financial-alert-rules");
  return response.data.rules ?? [];
};

export const saveFinancialAlertRule = async (
  type: FinancialAlertRuleRow["type"],
  payload: { daysOffset: number; channel: "sms" | "in_app" | "both"; isActive: boolean },
): Promise<void> => {
  await apiClient.put(`/financial-alert-rules/${type}`, {
    daysOffset: payload.daysOffset,
    channel: payload.channel,
    isActive: payload.isActive,
  });
}

export type FinancialAlertLog = {
  id: string;
  student_name: string;
  rule_type: string;
  channel: string;
  status: string;
  sent_at: string;
};

export type FinancialAlertLogsPage = {
  logs: FinancialAlertLog[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export const fetchFinancialAlertLogs = async (page = 1, limit = 20): Promise<FinancialAlertLogsPage> => {
  const response = await apiClient.get<FinancialAlertLogsPage>("/financial-alert-logs", {
    params: { page, limit },
  });
  return {
    logs: response.data.logs ?? [],
    pagination: response.data.pagination ?? { page, limit, total: 0, totalPages: 1 },
  };
}
