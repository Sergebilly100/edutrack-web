import axios from "axios"

import { apiClient } from "@/shared/api/client"
import { triggerBlobDownload } from "@/shared/api/pdfExport.api"

export const EXPORT_DISABLED_MESSAGE = "L’export de données est désactivé pour cet établissement."
export const EXPORT_FAILED_MESSAGE = "L’export a échoué. Réessayez dans un instant."

/** Télécharge un export Excel synchrone ; les erreurs sont traduites en messages lisibles. */
export async function downloadExcelExport(path: string, params: Record<string, string | boolean | undefined>, fileName: string): Promise<void> {
  try {
    const response = await apiClient.get(path, { params, responseType: "blob" })
    triggerBlobDownload(response.data as Blob, fileName)
  } catch (error) {
    throw new Error(await exportErrorMessage(error))
  }
}

async function exportErrorMessage(error: unknown): Promise<string> {
  if (!axios.isAxiosError(error)) return EXPORT_FAILED_MESSAGE
  let code: unknown = (error.response?.data as { code?: unknown } | undefined)?.code
  // Avec responseType "blob", le corps JSON de l'erreur arrive aussi sous forme de Blob.
  if (code === undefined && error.response?.data instanceof Blob) {
    try { code = (JSON.parse(await readBlobText(error.response.data)) as { code?: unknown }).code } catch { code = undefined }
  }
  return code === "EXPORT_DISABLED" ? EXPORT_DISABLED_MESSAGE : EXPORT_FAILED_MESSAGE
}

const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
