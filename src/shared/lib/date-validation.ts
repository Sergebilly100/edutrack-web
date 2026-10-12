import { addDaysIso, todayInBusinessTimezone } from "./business-date"

export const isCivilDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export const yesterdayInBusinessTimezone = (now = new Date()): string =>
  addDaysIso(todayInBusinessTimezone(now), -1)

export const birthDateIssue = (value: string, now = new Date()): string | null => {
  if (!value) return null
  if (!isCivilDate(value)) return "Date de naissance invalide : indiquez une date réelle."
  if (value >= todayInBusinessTimezone(now)) return "La date de naissance doit être antérieure à aujourd’hui."
  return null
}

export const dateRangeIssue = (from: string, to: string): string | null => {
  if ((from && !isCivilDate(from)) || (to && !isCivilDate(to))) return "Indiquez des dates réelles."
  if (from && to && from > to) return "La date de fin doit être postérieure ou égale à la date de début."
  return null
}

export const updateDateRange = (from: string, to: string, changed: "from" | "to", value: string) => {
  const next = { from: changed === "from" ? value : from, to: changed === "to" ? value : to }
  const cleared = Boolean(next.from && next.to && next.from > next.to)
  if (cleared) next[changed === "from" ? "to" : "from"] = ""
  return { ...next, message: cleared ? changed === "from"
    ? "La date de fin précédente était avant le nouveau début. Elle a été effacée."
    : "La date de début précédente était après la nouvelle fin. Elle a été effacée." : null }
}
