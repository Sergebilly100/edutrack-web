export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",")

/** Espace insécable : évite de couper « 1,4 Mo » ou « 1 200 × 600 px » en fin de ligne. */
const NBSP = String.fromCharCode(160)
const SIZE_FORMAT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" })

/** « 128 Ko », « 1,4 Mo » (espace insécable conservée pour éviter une coupure de ligne). */
export const formatFileSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${SIZE_FORMAT.format(bytes / (1024 * 1024))}${NBSP}Mo`
    : `${SIZE_FORMAT.format(Math.max(1, Math.round(bytes / 1024)))}${NBSP}Ko`

export const formatDimensions = (width: number, height: number): string =>
  `${new Intl.NumberFormat("fr-FR").format(width)}${NBSP}×${NBSP}${new Intl.NumberFormat("fr-FR").format(height)}${NBSP}px`

export const formatImportDate = (iso: string): string => DATE_FORMAT.format(new Date(iso))

export const imageTypeLabel = (mime: string | null): string | null => {
  if (mime === "image/png") return "PNG"
  if (mime === "image/jpeg") return "JPEG"
  if (mime === "image/webp") return "WebP"
  return null
}

/** Contrôle rapide avant envoi (le serveur reste l'autorité : type réel, dimensions, lisibilité). */
export const precheckImageFile = (file: File): string | null => {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Format non supporté. Utilisez une image PNG, JPEG ou WebP."
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Fichier trop volumineux (${formatFileSize(file.size)}). Maximum 2${NBSP}Mo.`
  }
  return null
}

export const readImageDimensions = async (file: File): Promise<{ width: number; height: number } | null> => {
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return null
  }
}

/** Lecture d'un Blob via FileReader : disponible partout (Blob.text() manque à certains environnements). */
const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

const GENERIC_ERROR = "Impossible d'envoyer l'image. Vérifiez votre connexion puis réessayez."

/** Message d'erreur lisible, y compris quand la réponse d'erreur est un Blob (requêtes responseType: blob). */
export const extractApiErrorMessage = async (error: unknown): Promise<string> => {
  if (typeof error !== "object" || error === null) return GENERIC_ERROR
  const candidate = error as { response?: { data?: unknown }; code?: string }
  let data = candidate.response?.data
  if (data instanceof Blob) {
    try {
      data = JSON.parse(await readBlobText(data))
    } catch {
      return GENERIC_ERROR
    }
  }
  const message = (data as { error?: unknown } | undefined)?.error
  if (typeof message === "string" && message.length > 0) return message
  return candidate.code === "ECONNABORTED" ? "Le délai d'envoi est dépassé. Réessayez." : GENERIC_ERROR
}
