import { apiClient as api } from "@/shared/api/client"

/**
 * Client générique du pipeline d'export PDF asynchrone (queue → R2 → download).
 * Partagé par tous les bilans : salaires, heures profs, absences élèves,
 * présences profs, reversements. Le backend expose /jobs/:id/status et renvoie
 * une URL de téléchargement signée une fois le job terminé.
 */

export type PdfExportJobState = "queued" | "running" | "done" | "failed" | "unknown"

export type PdfExportJobStatus = {
  jobId: string
  status: PdfExportJobState
  downloadUrl: string | null
  failedReason?: string | null
}

const resolveState = (raw: string | null | undefined): PdfExportJobState => {
  switch (raw) {
    case "queued":
    case "pending":
      return "queued"
    case "running":
    case "processing":
    case "active":
      return "running"
    case "done":
    case "completed":
      return "done"
    case "failed":
      return "failed"
    default:
      return "unknown"
  }
}

const API_PREFIX_PATTERN = /^https?:\/\/[^/]+\/api\/v1/i

/**
 * Le backend renvoie une URL absolue (signée). On la normalise vers le chemin
 * relatif consommé par l'instance axios (baseURL = /api/v1) afin de conserver
 * les credentials et de ne pas dépendre du host.
 */
const buildExportApiPath = (rawUrl: string): string => {
  const stripped = rawUrl.replace(API_PREFIX_PATTERN, "")
  return stripped.startsWith("/") ? stripped : `/${stripped}`
}

const FILENAME_PATTERN = /filename="?([^"]+)"?/i

const extractFileName = (disposition: string | null): string | null => {
  if (!disposition) {
    return null
  }
  const match = FILENAME_PATTERN.exec(disposition)
  return match?.[1] ?? null
}

export const getPdfExportJobStatus = async (jobId: string): Promise<PdfExportJobStatus> => {
  const response = await api.get(`/jobs/${jobId}/status`)
  const payload = response.data ?? {}
  const result: { downloadUrl?: string | null; resultUrl?: string | null } = payload.result ?? {}
  const possibleUrl =
    payload.resultUrl ??
    payload.downloadUrl ??
    result.resultUrl ??
    result.downloadUrl ??
    null
  return {
    jobId: String(payload.jobId ?? jobId),
    status: resolveState(payload.status ?? payload.state ?? null),
    downloadUrl: possibleUrl,
    failedReason: payload.failedReason ?? null,
  }
}

export const downloadPdfExportFile = async (
  downloadUrl: string
): Promise<{ blob: Blob; fileName: string | null }> => {
  const response = await api.get<Blob>(buildExportApiPath(downloadUrl), {
    responseType: "blob",
  })
  const disposition =
    (response.headers["content-disposition"] as string | undefined) ?? null
  return {
    blob: response.data,
    fileName: extractFileName(disposition),
  }
}

/** Déclenche le téléchargement du blob dans le navigateur. */
export const triggerBlobDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
