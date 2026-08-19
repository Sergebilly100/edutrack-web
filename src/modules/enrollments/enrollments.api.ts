import { apiClient } from "@/shared/api/client"

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
}

export type StudentDocument = {
  id: string
  studentId: string
  documentTypeId: string
  documentTypeName: string
  isMandatory: boolean
  status: StudentDocumentStatus
  fileUrl: string | null
  r2Key: string | null
  providedAt: string | null
  notes: string | null
}

export type RequiredDocumentType = {
  id: string
  level_id: string
  level_name: string
  name: string
  is_mandatory: boolean
}

export type CreateEnrollmentResult = {
  enrollment: Enrollment
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
  hasPreviousYearUnpaid: boolean
}): Promise<CreateEnrollmentResult> {
  const response = await apiClient.post<CreateEnrollmentResult>("/enrollments", payload)
  return response.data
}

export async function confirmEnrollmentPayment(id: string): Promise<CreateEnrollmentResult> {
  const response = await apiClient.post<CreateEnrollmentResult>(`/enrollments/${id}/confirm-payment`)
  return response.data
}

export async function listRequiredDocumentTypes(levelId: string): Promise<RequiredDocumentType[]> {
  const response = await apiClient.get<{ documentTypes: RequiredDocumentType[] }>("/required-document-types", {
    params: { level_id: levelId },
  })
  return response.data.documentTypes
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
