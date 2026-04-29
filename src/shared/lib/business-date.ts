export const TIMEZONE_METIER = "Africa/Abidjan"

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE_METIER,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const monthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE_METIER,
  year: "numeric",
  month: "2-digit",
})

export const todayInBusinessTimezone = (value = new Date()): string => dateFormatter.format(value)

export const monthKeyInBusinessTimezone = (value = new Date()): string => {
  const parts = monthFormatter.formatToParts(value)
  const year = parts.find((item) => item.type === "year")?.value ?? "1970"
  const month = parts.find((item) => item.type === "month")?.value ?? "01"
  return `${year}-${month}`
}

export const addDaysIso = (isoDate: string, days: number): string => {
  const base = new Date(`${isoDate}T00:00:00.000Z`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

export const addMonthsIso = (isoDate: string, months: number): string => {
  const base = new Date(`${isoDate}T00:00:00.000Z`)
  base.setUTCMonth(base.getUTCMonth() + months)
  return base.toISOString().slice(0, 10)
}
