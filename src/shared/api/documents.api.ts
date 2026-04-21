import { apiClient } from "@/shared/api/client"

export type DocumentEntityType = "teacher" | "student"
export type DocumentType = "diplome" | "cni" | "contrat" | "releve_notes" | "photo" | "autre"

export type DocumentItem = {
  id: string
  entityType: DocumentEntityType
  entityId: string
  type: DocumentType
  name: string
  uploadedBy: string
  createdAt: string
  url: string
}

type RawDocumentItem = {
  id?: unknown
  entityType?: unknown
  entity_type?: unknown
  entityId?: unknown
  entity_id?: unknown
  type?: unknown
  name?: unknown
  uploadedBy?: unknown
  uploaded_by?: unknown
  createdAt?: unknown
  created_at?: unknown
  url?: unknown
}

const isEntityType = (value: unknown): value is DocumentEntityType => value === "teacher" || value === "student"
const isDocumentType = (value: unknown): value is DocumentType =>
  value === "diplome" ||
  value === "cni" ||
  value === "contrat" ||
  value === "releve_notes" ||
  value === "photo" ||
  value === "autre"

const normalizeDocumentItem = (raw: unknown): DocumentItem => {
  const item = (raw ?? {}) as RawDocumentItem

  const id =
    typeof item.id === "string" && item.id.length > 0
      ? item.id
      : `doc-${Date.now()}-${Math.round(Math.random() * 100000)}`
  const entityTypeCandidate = item.entityType ?? item.entity_type
  const entityType: DocumentEntityType = isEntityType(entityTypeCandidate) ? entityTypeCandidate : "teacher"
  const entityIdCandidate = item.entityId ?? item.entity_id
  const entityId = typeof entityIdCandidate === "string" ? entityIdCandidate : ""
  const type: DocumentType = isDocumentType(item.type) ? item.type : "autre"
  const name = typeof item.name === "string" && item.name.length > 0 ? item.name : "Document"
  const uploadedByCandidate = item.uploadedBy ?? item.uploaded_by
  const uploadedBy = typeof uploadedByCandidate === "string" ? uploadedByCandidate : ""
  const createdAtCandidate = item.createdAt ?? item.created_at
  const createdAt = typeof createdAtCandidate === "string" ? createdAtCandidate : new Date().toISOString()
  const url = typeof item.url === "string" ? item.url : ""

  return { id, entityType, entityId, type, name, uploadedBy, createdAt, url }
}

export const listDocuments = async (entityType: DocumentEntityType, entityId: string): Promise<DocumentItem[]> => {
  const response = await apiClient.get<{ data?: unknown }>(`/documents/${entityType}/${entityId}`)
  const payload = Array.isArray(response.data?.data) ? response.data.data : []
  return payload.map(normalizeDocumentItem)
}

export const uploadDocument = async (input: {
  entityType: DocumentEntityType
  entityId: string
  file: File
  type?: DocumentType
  name?: string
}): Promise<DocumentItem> => {
  const formData = new FormData()
  formData.append("type", input.type ?? "autre")
  formData.append("name", input.name ?? input.file.name)
  formData.append("file", input.file)

  const response = await apiClient.post<unknown>(`/documents/${input.entityType}/${input.entityId}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })

  return normalizeDocumentItem(response.data)
}

export const getDocumentDownloadUrl = async (documentId: string): Promise<string> => {
  const response = await apiClient.get<{ url?: unknown }>(`/documents/${documentId}/download`)
  return typeof response.data?.url === "string" ? response.data.url : ""
}

export const downloadDocumentFile = async (
  documentId: string
): Promise<{ blob: Blob; fileName: string | null }> => {
  const response = await apiClient.get<Blob>(`/documents/${documentId}/download`, {
    params: { raw: "true" },
    responseType: "blob",
  })

  const disposition = response.headers["content-disposition"]
  const match = typeof disposition === "string" ? disposition.match(/filename="?([^";]+)"?/i) : null
  return {
    blob: response.data,
    fileName: match?.[1] ?? null,
  }
}

export const deleteDocument = async (documentId: string): Promise<void> => {
  await apiClient.delete(`/documents/${documentId}`)
}
