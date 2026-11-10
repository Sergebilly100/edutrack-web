export const formatFcfa = (value: number): string =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

export const formatFcfaBalance = (value: number): string =>
  value < 0 ? `Avance de ${formatFcfa(Math.abs(value))}` : formatFcfa(value)

export const formatMillionsFcfa = (value: number): string =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value / 1_000_000)} M FCFA`

export const formatRate = (rate: number): string => `${Math.round(rate)}%`

const ABIDJAN_TZ = "Africa/Abidjan"

/** Format unique des dates de mention : « 9 nov. 2026 » ou « 9 nov. 2026 à 14:30 » (heure seulement si connue). */
export const formatDateTimeFr = (value: string | Date, options: { withTime?: boolean } = {}): string => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: ABIDJAN_TZ }).format(date)
  if (options.withTime === false) return day
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: ABIDJAN_TZ }).format(date)
  return `${day} à ${time}`
}
