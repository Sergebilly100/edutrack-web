import { cn } from "@/lib/utils"
import type { TeacherMonthlyAttendanceRow, TeacherMonthlyAttendanceStatus } from "@/modules/teachers/teachers.api"

type PresenceHeatmapProps = {
  month: string
  rows: TeacherMonthlyAttendanceRow[]
}

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"]

const statusClass: Record<TeacherMonthlyAttendanceStatus, string> = {
  present: "bg-green-500",
  late: "bg-amber-500",
  absent: "bg-red-500",
  excused: "bg-blue-500",
  not_marked: "bg-slate-200",
}

const statusLabel: Record<TeacherMonthlyAttendanceStatus, string> = {
  present: "Présent",
  late: "Retard",
  absent: "Absent",
  excused: "Excusé",
  not_marked: "Non marqué",
}

const toMonthLabel = (month: string) => {
  const [yearRaw, monthRaw] = month.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return month
  }

  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, monthIndex, 1))
  )
}

const toDateKey = (date: Date) => date.toISOString().slice(0, 10)

const isoWeekDayIndex = (date: Date) => {
  const day = date.getUTCDay()
  return day === 0 ? 6 : day - 1
}

export function PresenceHeatmap({ month, rows }: PresenceHeatmapProps) {
  const [yearRaw, monthRaw] = month.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return <p className="text-sm text-muted-foreground">Mois invalide.</p>
  }

  const firstDay = new Date(Date.UTC(year, monthIndex, 1))
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

  const statusByDate = new Map<string, TeacherMonthlyAttendanceStatus>()
  for (const row of rows) {
    if (!statusByDate.has(row.date) || row.attendanceStatus === "absent") {
      statusByDate.set(row.date, row.attendanceStatus)
    }
  }

  const prefix = isoWeekDayIndex(firstDay)
  const cells: Array<{ date: Date | null; status: TeacherMonthlyAttendanceStatus }> = []

  for (let index = 0; index < prefix; index += 1) {
    cells.push({ date: null, status: "not_marked" })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day))
    const dateKey = toDateKey(date)
    cells.push({ date, status: statusByDate.get(dateKey) ?? "not_marked" })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, status: "not_marked" })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium capitalize">{toMonthLabel(month)}</p>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {WEEK_DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) => (
          <div
            key={`${cell.date ? toDateKey(cell.date) : "empty"}-${index}`}
            className={cn(
              "flex h-7 items-center justify-center rounded-md border text-[10px]",
              cell.date ? "border-border" : "border-transparent",
              cell.date ? statusClass[cell.status] : "bg-transparent"
            )}
            title={
              cell.date
                ? `${cell.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} · ${statusLabel[cell.status]}`
                : undefined
            }
          >
            <span className={cn("font-medium", cell.date ? "text-white" : "text-transparent")}>
              {cell.date ? cell.date.getUTCDate() : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />Présent</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Retard</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Absent</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Excusé</span>
      </div>
    </div>
  )
}
