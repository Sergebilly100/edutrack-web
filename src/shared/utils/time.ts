/**
 * Time utilities — source unique de vérité pour normalisation
 *
 * QUALITÉ FIX : Élimine duplication entre schedule.api.ts et autres modules
 */

/**
 * Normalise "HH:MM:SS" → "HH:MM". Laisse "HH:MM" inchangé.
 * Ex : "07:30:00" → "07:30" | "08:00" → "08:00"
 */
export const normalizeTime = (raw: string): string => {
  if (!raw) return raw
  const parts = raw.split(":")
  if (parts.length < 2) return raw
  return `${parts[0]}:${parts[1]}`
}

/**
 * Convertit "HH:MM" en minutes depuis minuit
 * Ex: "08:30" → 510
 */
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

/**
 * Convertit minutes depuis minuit en "HH:MM"
 * Ex: 510 → "08:30"
 */
export const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}
