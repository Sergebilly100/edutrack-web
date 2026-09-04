import { apiClient } from "@/shared/api/client"
import { asBoolean, asNumber, asString, isRecord } from "@/shared/utils/parsers"

export type EnrollmentStatus = "pending_cashier" | "pending_dossier" | "confirmed" | "blocked_unpaid"
export type EnrollmentType = "new_registration" | "re_registration"
export type StudentDocumentStatus = "missing" | "provided" | "to_renew"

export type Enrollment = {
  id: string
  studentId: string
  classId: string
  className: string
  studentFirstName: string
  studentLastName: string
  schoolYearId: string
  schoolYearLabel: string
  type: EnrollmentType
  status: EnrollmentStatus
  enrolledAt: string
  confirmedByUserId: string | null
  documentStatus: "not_configured" | "complete" | "incomplete"
  missingMandatoryDocumentCount: number
}

export type StudentDocument = {
  id: string
  studentId: string
  documentTypeId: string
  documentTypeName: string
  isMandatory: boolean
  isActive: boolean
  status: StudentDocumentStatus
  fileUrl: string | null
  r2Key: string | null
  providedAt: string | null
  notes: string | null
}

export type RequiredDocumentType = {
  id: string
  levelId: string
  levelName: string
  name: string
  isMandatory: boolean
  isActive: boolean
}

const parseRequiredDocumentType = (value: unknown): RequiredDocumentType => {
  const row = isRecord(value) ? value : {}
  return {
    id: asString(row.id),
    levelId: asString(row.levelId ?? row.level_id),
    levelName: asString(row.levelName ?? row.level_name),
    name: asString(row.name),
    isMandatory: asBoolean(row.isMandatory ?? row.is_mandatory),
    isActive: asBoolean(row.isActive ?? row.is_active),
  }
}

export type CreateEnrollmentResult = {
  enrollment: Enrollment
  payment?: { id: string; receiptNumber?: string }
  receiptJobId?: string
  missingMandatoryDocuments: StudentDocument[]
  documentWarning: string | null
}

export type EnrollmentsListResponse = {
  enrollments: Enrollment[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const parseEnrollment = (value: unknown): Enrollment | null => {
  if (!isRecord(value)) return null
  const statusValue = asString(value.status)
  const typeValue = asString(value.type)
  const documentStatusValue = asString(value.documentStatus ?? value.document_status)
  const id = asString(value.id)
  const studentId = asString(value.studentId ?? value.student_id)
  if (!id || !studentId) return null

  return {
    id,
    studentId,
    classId: asString(value.classId ?? value.class_id),
    className: asString(value.className ?? value.class_name),
    studentFirstName: asString(value.studentFirstName ?? value.student_first_name),
    studentLastName: asString(value.studentLastName ?? value.student_last_name),
    schoolYearId: asString(value.schoolYearId ?? value.school_year_id),
    schoolYearLabel: asString(value.schoolYearLabel ?? value.school_year_label),
    type: typeValue === "re_registration" ? "re_registration" : "new_registration",
    status: statusValue === "pending_dossier" || statusValue === "confirmed" || statusValue === "blocked_unpaid"
      ? statusValue
      : "pending_cashier",
    enrolledAt: asString(value.enrolledAt ?? value.enrolled_at),
    confirmedByUserId: asString(value.confirmedByUserId ?? value.confirmed_by_user_id) || null,
    documentStatus: documentStatusValue === "complete" || documentStatusValue === "incomplete"
      ? documentStatusValue
      : "not_configured",
    missingMandatoryDocumentCount: asNumber(value.missingMandatoryDocumentCount ?? value.missing_mandatory_document_count),
  }
}

export const normalizeEnrollmentsListResponse = (
  payload: unknown,
  requestedPage = 1,
  requestedLimit = 20,
): EnrollmentsListResponse => {
  const root = isRecord(payload) ? payload : {}
  const firstLevel = root.enrollments
  const nested = isRecord(firstLevel) ? firstLevel : root
  const secondLevel = nested.enrollments
  const deeplyNested = isRecord(secondLevel) ? secondLevel : nested
  const rawEnrollments = Array.isArray(deeplyNested.enrollments)
    ? deeplyNested.enrollments
    : Array.isArray(secondLevel)
      ? secondLevel
      : Array.isArray(firstLevel)
        ? firstLevel
        : Array.isArray(payload)
          ? payload
          : []
  const enrollments = rawEnrollments.flatMap((item) => {
    const parsed = parseEnrollment(item)
    return parsed ? [parsed] : []
  })
  const paginationSource = isRecord(deeplyNested.pagination)
    ? deeplyNested.pagination
    : isRecord(nested.pagination)
      ? nested.pagination
      : isRecord(root.pagination)
        ? root.pagination
        : {}
  const total = asNumber(paginationSource.total, enrollments.length)

  return {
    enrollments,
    pagination: {
      page: asNumber(paginationSource.page, requestedPage),
      limit: asNumber(paginationSource.limit, requestedLimit),
      total,
      totalPages: asNumber(paginationSource.totalPages ?? paginationSource.total_pages, Math.max(1, Math.ceil(total / requestedLimit))),
    },
  }
}

export async function listEnrollments(params: {
  page?: number
  limit?: number
  type?: EnrollmentType
  schoolYearId?: string
  status?: EnrollmentStatus
} = {}): Promise<EnrollmentsListResponse> {
  const requestedPage = params.page ?? 1
  const requestedLimit = params.limit ?? 20
  const response = await apiClient.get<unknown>("/enrollments", {
    params: {
      page: requestedPage,
      limit: requestedLimit,
      ...(params.type ? { type: params.type } : {}),
      ...(params.schoolYearId ? { school_year_id: params.schoolYearId } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
  })
  return normalizeEnrollmentsListResponse(response.data, requestedPage, requestedLimit)
}

export async function getEnrollment(id: string): Promise<Enrollment> {
  const response = await apiClient.get<{ enrollment: Enrollment }>(`/enrollments/${id}`)
  return response.data.enrollment
}

export async function updateEnrollment(id: string, payload: { classId: string }): Promise<Enrollment> {
  const response = await apiClient.patch<{ enrollment: Enrollment }>(`/enrollments/${id}`, payload)
  return response.data.enrollment
}

export async function createEnrollment(payload: {
  studentId: string
  classId: string
  schoolYearId: string
  type: EnrollmentType
  hasPreviousYearUnpaid?: boolean
}): Promise<CreateEnrollmentResult> {
  const response = await apiClient.post<CreateEnrollmentResult>("/enrollments", payload)
  return response.data
}

export type EnrollmentPaymentSummary = {
  enrollment: Enrollment
  amountDue: number
  currency: string
  totalDue: number
  confirmedPaid: number
}

export async function getEnrollmentPaymentSummary(id: string): Promise<EnrollmentPaymentSummary> {
  const response = await apiClient.get<EnrollmentPaymentSummary>(`/enrollments/${id}/payment-summary`)
  return response.data
}

export async function confirmEnrollmentPayment(id: string, payload: {
  amount: number
  method: "mobile_money" | "cash" | "bank_transfer"
  providerReference?: string
  schoolReceiptReference: string
}): Promise<CreateEnrollmentResult> {
  const response = await apiClient.post<CreateEnrollmentResult>(`/enrollments/${id}/confirm-payment`, payload)
  return response.data
}

export async function listRequiredDocumentTypes(levelId?: string): Promise<RequiredDocumentType[]> {
  const response = await apiClient.get<{ documentTypes: unknown[] }>("/required-document-types", {
    params: levelId ? { level_id: levelId } : undefined,
  })
  return response.data.documentTypes.map(parseRequiredDocumentType)
}

export async function createRequiredDocumentTypes(payload: {
  levelIds: string[]
  name: string
  isMandatory: boolean
}): Promise<RequiredDocumentType[]> {
  const response = await apiClient.post<{ documentTypes: unknown[] }>("/required-document-types/bulk", payload)
  return response.data.documentTypes.map(parseRequiredDocumentType)
}

export async function syncRequiredDocumentTypes(payload: {
  documentTypeIds: string[]
  levelIds: string[]
  name: string
  isMandatory: boolean
}): Promise<RequiredDocumentType[]> {
  const response = await apiClient.put<{ documentTypes: unknown[] }>("/required-document-types/bulk", payload)
  return response.data.documentTypes.map(parseRequiredDocumentType)
}

export async function listRequiredDocumentLevels(): Promise<Array<{ id: string; name: string }>> {
  const response = await apiClient.get<{ levels: unknown[] }>("/required-document-levels")
  return response.data.levels.map((value) => {
    const row = isRecord(value) ? value : {}
    return { id: asString(row.id), name: asString(row.name) }
  })
}

export async function createRequiredDocumentType(payload: {
  levelId: string
  name: string
  isMandatory: boolean
}): Promise<RequiredDocumentType> {
  const response = await apiClient.post<{ documentType: unknown }>("/required-document-types", payload)
  return parseRequiredDocumentType(response.data.documentType)
}

export async function updateRequiredDocumentType(
  id: string,
  payload: { name?: string; isMandatory?: boolean; isActive?: boolean },
): Promise<RequiredDocumentType> {
  const response = await apiClient.patch<{ documentType: unknown }>(`/required-document-types/${id}`, payload)
  return parseRequiredDocumentType(response.data.documentType)
}

export async function archiveRequiredDocumentType(id: string): Promise<void> {
  await apiClient.delete(`/required-document-types/${id}`)
}

export async function listStudentDocuments(studentId: string): Promise<StudentDocument[]> {
  const response = await apiClient.get<{ documents: StudentDocument[] }>(`/students/${studentId}/enrollment-documents`)
  return response.data.documents
}

export async function updateStudentDocument(
  id: string,
  payload: { status: StudentDocumentStatus; notes?: string | null },
): Promise<StudentDocument> {
  const response = await apiClient.patch<{ document: StudentDocument }>(`/student-documents/${id}`, payload)
  return response.data.document
}

export async function uploadStudentDocument(
  studentId: string,
  documentTypeId: string,
  file: File,
): Promise<StudentDocument> {
  const data = new FormData()
  data.append("documentTypeId", documentTypeId)
  data.append("file", file)
  const response = await apiClient.post<{ document: StudentDocument }>(
    `/students/${studentId}/enrollment-documents/upload`,
    data,
  )
  return response.data.document
}

export async function getStudentDocumentDownloadUrl(documentId: string): Promise<string> {
  const response = await apiClient.get<{ url: string }>(`/student-documents/${documentId}/download`)
  return response.data.url
}

export async function verifyStudentDocuments(studentId: string): Promise<{
  documents: StudentDocument[]
  missingMandatoryDocuments: StudentDocument[]
  dossierComplete: boolean
  notificationQueued: boolean
}> {
  const response = await apiClient.post(`/students/${studentId}/enrollment-documents/verify`)
  return response.data
}
