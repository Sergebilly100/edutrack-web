export type SalaryStatus = "pending" | "paid" | "disputed" | "nothing_to_pay"

export const toDisplayedStatus = (status: string, isPartiallyPaid: boolean | null): string => {
  if (status === "Salaire fixe") return "Salaire fixe"
  if (status === "disputed") return "Litige"
  if (status === "nothing_to_pay") return "Rien à payer"
  if (isPartiallyPaid) return "Payé partiellement"
  if (status === "paid") return "Payé"
  return "En attente"
}

export const toSortableTime = (value: string): string => {
  const trimmed = value.trim()
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.slice(0, 5)
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed
  return "00:00"
}

export const computeAbsenceHours = (
  rows: Array<{
    date: string
    endTime: string
    attendanceStatus: string
    validationStatus?: string | null
    hoursPlanned: number
    hoursDone?: number
  }>,
  now: Date
): number =>
  rows.reduce((acc, row) => {
    const rowDateTime = new Date(`${row.date}T${toSortableTime(row.endTime)}:00`)
    if (rowDateTime.getTime() > now.getTime()) {
      return acc
    }

    if (row.attendanceStatus === "absent" || row.attendanceStatus === "not_marked") {
      return acc + row.hoursPlanned
    }

    if (row.validationStatus === "pending") {
      return acc
    }

    if (row.validationStatus !== "approved" && row.validationStatus !== "rejected") {
      return acc
    }

    const hoursDone = row.hoursDone ?? row.hoursPlanned
    const missingHours = Math.max(0, row.hoursPlanned - hoursDone)
    if (missingHours > 0) {
      return acc + missingHours
    }

    return acc
  }, 0)

export const computeRemainingHours = (
  rows: Array<{ date: string; startTime: string; hoursPlanned: number }>,
  now: Date
): number =>
  rows.reduce((acc, row) => {
    const rowDateTime = new Date(`${row.date}T${toSortableTime(row.startTime)}:00`)
    if (rowDateTime.getTime() > now.getTime()) {
      return acc + row.hoursPlanned
    }
    return acc
  }, 0)
