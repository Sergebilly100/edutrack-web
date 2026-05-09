const getMonthKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export const getCurrentMonth = (): string => getMonthKey(new Date())

export const addMonths = (month: string, amount: number): string => {
  const [yearRaw, monthRaw] = month.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const moved = new Date(Date.UTC(year, monthIndex + amount, 1))
  return getMonthKey(moved)
}

export const getPreviousMonth = (month: string): string => addMonths(month, -1)

export const getNextMonth = (month: string): string => addMonths(month, 1)

export const isFutureMonth = (month: string): boolean => month > getCurrentMonth()

export const getRecentMonthOptions = (aroundMonth: string, count = 18): string[] => {
  const safeCount = Math.max(1, count)
  return Array.from({ length: safeCount }, (_, index) => getPreviousMonth(addMonths(aroundMonth, 1 - index)))
}

export const formatMonthLabel = (month: string): string => {
  const [yearRaw, monthRaw] = month.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return month
  }

  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, monthIndex, 1)))
}
