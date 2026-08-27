import { apiClient } from "@/shared/api/client"
import { asBoolean, asString, isRecord } from "@/shared/utils/parsers"

export type EnrollmentStatus = "pending_cashier" | "pending_dossier" | "confirmed" | "blocked_unpaid"
export type EnrollmentType = "new_registration" | "re_registration"
export type StudentDocumentStatus = "missing" | "provided" | "to_renew"

export type Enrollment = {
  id: string
  studentId: string
  classId: string
  className: string
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

export async function listEnrollments(type?: EnrollmentType): Promise<Enrollment[]> {
  const response = await apiClient.get<{ enrollments: Enrollment[] }>("/enrollments", {
    params: type ? { type } : undefined,
  })
  return response.data.enrollments
}

export async function getEnrollment(id: string): Promise<Enrollment> {
  const response = await apiClient.get<{ enrollment: Enrollment }>(`/enrollments/${id}`)
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
  method: "mobile_money" | "cash" | "bank_transfer"
  providerReference?: string
  schoolReceiptReference?: string
}): Promise<CreateEnrollmentResult> {
  const response = await apiClient.post<CreateEnrollmentResult>(`/enrollments/${id}/confirm-payment`, payload)
  return response.data
}

export async function listRequiredDocumentTypes(levelId: string): Promise<RequiredDocumentType[]> {
  const response = await apiClient.get<{ documentTypes: unknown[] }>("/required-document-types", {
    params: { level_id: levelId },
  })
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

export async function verifyStudentDocuments(studentId: string): Promise<{
  documents: StudentDocument[]
  missingMandatoryDocuments: StudentDocument[]
  dossierComplete: boolean
  notificationQueued: boolean
}> {
  const response = await apiClient.post(`/students/${studentId}/enrollment-documents/verify`)
  return response.data
}
