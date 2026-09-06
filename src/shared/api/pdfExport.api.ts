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

/**
 * Lance l'URL signée comme une navigation du navigateur.
 *
 * L'endpoint API redirige vers R2. Une requête XHR/Axios suivrait cette
 * redirection et serait bloquée si R2 ne publie pas ses en-têtes CORS. Une
 * navigation n'est pas soumise à CORS et R2 fournit déjà
 * Content-Disposition: attachment avec le nom de fichier signé.
 */
export const triggerPdfExportDownload = (downloadUrl: string, fallbackFileName?: string): void => {
  const link = document.createElement("a")
  link.href = downloadUrl
  if (fallbackFileName) {
    link.download = fallbackFileName
  }
  link.referrerPolicy = "no-referrer"
  document.body.appendChild(link)
  link.click()
  link.remove()
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
  // Android Chrome peut encore consommer le Blob après le retour de click().
  // Reporter la révocation laisse le navigateur démarrer le téléchargement sans
  // garder l'URL en mémoire au-delà du prochain tour de boucle d'événements.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
