import type { EnrollmentStatus, StudentDocument } from "./enrollments.api"

export const enrollmentStatusLabel: Record<EnrollmentStatus, string> = {
  pending_cashier: "En attente de caisse",
  pending_dossier: "Dossier à compléter",
  confirmed: "Confirmée",
  blocked_unpaid: "Bloquée pour impayé",
}

export const countMissingMandatoryDocuments = (documents: StudentDocument[]): number =>
  documents.filter((document) => document.isActive !== false && document.isMandatory && document.status !== "provided").length

export const getScaledDimensions = (
  width: number,
  height: number,
  maxDimension = 1600,
): { width: number; height: number } => {
  if (width <= maxDimension && height <= maxDimension) return { width, height }
  const ratio = maxDimension / Math.max(width, height)
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

const loadImage = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image()
  const url = URL.createObjectURL(file)
  image.onload = () => {
    URL.revokeObjectURL(url)
    resolve(image)
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error("Impossible de lire l’image."))
  }
  image.src = url
})

export async function compressEnrollmentImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  const image = await loadImage(file)
  const dimensions = getScaledDimensions(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement("canvas")
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Compression d’image indisponible sur cet appareil.")
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78))
  if (!blob) throw new Error("La compression de l’image a échoué.")
  if (blob.size >= file.size) return file
  const baseName = file.name.replace(/\.[^.]+$/, "")
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
}
