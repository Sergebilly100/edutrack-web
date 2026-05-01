import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react"

import { EmptyState } from "@/shared/components"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { getParentSchedule, listParentStudents } from "@/modules/parent-portal/parent.api"
import { currentIsoWeek, shiftIsoWeek, weekDaysFr } from "@/modules/parent-portal/parent.utils"
import { todayInBusinessTimezone } from "@/shared/lib/business-date"

const SELECTED_STUDENT_STORAGE_KEY = "parent_selected_student_id"

type DayViewItem = {
  date: string
  label: string
  slots: Array<{
    time: string
    subject: string
    teacher: string
    room: string
    status: "present" | "absent" | "upcoming" | "unknown"
  }>
}

export default function ParentSchedulePage() {
  const studentsQuery = useQuery({
    queryKey: ["parent", "students", "schedule-page"],
    queryFn: listParentStudents,
  })

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    () => sessionStorage.getItem(SELECTED_STUDENT_STORAGE_KEY) ?? ""
  )
  const [week, setWeek] = useState(currentIsoWeek())
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)

  useEffect(() => {
    const students = studentsQuery.data ?? []
    if (students.length === 0) return
    if (students.some((s) => s.id === selectedStudentId)) return
    setSelectedStudentId(students[0].id)
  }, [studentsQuery.data, selectedStudentId])

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId)
    sessionStorage.setItem(SELECTED_STUDENT_STORAGE_KEY, studentId)
  }

  const scheduleQuery = useQuery({
    queryKey: ["parent", "schedule", selectedStudentId, week],
    queryFn: () => getParentSchedule(selectedStudentId, week),
    enabled: selectedStudentId.length > 0,
  })

  const selectedStudent = useMemo(
    () => (studentsQuery.data ?? []).find((item) => item.id === selectedStudentId) ?? null,
    [selectedStudentId, studentsQuery.data]
  )

  const days: DayViewItem[] = useMemo(
    () =>
      (scheduleQuery.data?.days ?? [])
        .map((day, index) => ({
          date: day.day,
          label: weekDaysFr[index] ?? "Jour",
          slots: day.slots,
        }))
        .filter((day) => new Date(`${day.date}T00:00:00.000Z`).getUTCDay() !== 0),
    [scheduleQuery.data]
  )

  const weekRangeLabel = useMemo(() => {
    if (days.length === 0) return week
    const formatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })
    const start = formatter.format(new Date(`${days[0].date}T00:00:00.000Z`))
    const end = formatter.format(new Date(`${days[days.length - 1].date}T00:00:00.000Z`))
    return `Du ${start} au ${end}`
  }, [days, week])

  useEffect(() => {
    if (!scheduleQuery.data) return
    const today = todayInBusinessTimezone()
    const idx = days.findIndex((d) => d.date === today)
    setSelectedDayIndex(idx >= 0 ? idx : 0)
  }, [scheduleQuery.data, selectedStudentId, week, days])

  const isInitialScheduleLoading = scheduleQuery.isLoading && !scheduleQuery.data

  if (studentsQuery.isLoading) {
    return <Skeleton className="h-24 w-full rounded-lg" />
  }

  return (
    <div className="space-y-4 text-base">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Emploi du temps</h1>
      </section>

      <section>
        {(studentsQuery.data?.length ?? 0) > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {(studentsQuery.data ?? []).map((student) => (
              <Button
                key={student.id}
                type="button"
                variant={selectedStudentId === student.id ? "default" : "ghost"}
                className="h-12 flex-shrink-0 rounded-full text-sm"
                onClick={() => handleSelectStudent(student.id)}
              >
                {student.first_name} {student.last_name}
              </Button>
            ))}
          </div>
        ) : selectedStudent ? (
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {selectedStudent.first_name[0]}{selectedStudent.last_name[0]}
            </div>
            <div>
              <p className="text-sm font-semibold">{selectedStudent.first_name} {selectedStudent.last_name}</p>
              <p className="text-xs text-muted-foreground">{selectedStudent.class_name}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Programme</h2>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setWeek((prev) => shiftIsoWeek(prev, -1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="min-w-[140px] text-center text-sm text-muted-foreground">{weekRangeLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setWeek((prev) => shiftIsoWeek(prev, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {scheduleQuery.isFetching && !isInitialScheduleLoading ? (
          <p className="text-xs text-muted-foreground">Mise à jour du programme…</p>
        ) : null}

        <div className="grid grid-cols-6 gap-1">
          {days.map((day, index) => {
            const isToday = day.date === todayInBusinessTimezone()
            const isSelected = selectedDayIndex === index
            return (
              <Button
                key={day.date}
                type="button"
                onClick={() => setSelectedDayIndex(index)}
                className={cn(
                  "flex h-10 w-full flex-col items-center justify-center rounded-xl px-1 py-1 text-center transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <span className="text-[14px] font-medium leading-[0.25]">{day.label}</span>
                <span className="text-sm font-semibold leading-none">{new Date(`${day.date}T00:00:00.000Z`).getUTCDate()}</span>
              </Button>
            )
          })}
        </div>

        {isInitialScheduleLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : (days[selectedDayIndex]?.slots.length ?? 0) === 0 ? (
          <EmptyState title="Pas de cours ce jour" message="Aucun cours au programme." />
        ) : (
          <div className="space-y-2">
            {(days[selectedDayIndex]?.slots ?? []).map((slot, index) => (
              <div
                key={`slot-${index}`}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3",
                  slot.status === "absent"
                    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                    : slot.status === "present"
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                      : "border-border bg-muted/40"
                )}
              >
                <div className="w-14 flex-shrink-0 text-center">
                  <p className="text-xs font-semibold leading-tight text-muted-foreground">{slot.time}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{slot.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">{slot.teacher} · {slot.room}</p>
                </div>
                <div className="flex-shrink-0">
                  {slot.status === "absent" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      <XCircle className="h-3 w-3" /> Absent
                    </span>
                  )}
                  {slot.status === "present" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Présent
                    </span>
                  )}
                  {slot.status === "upcoming" && (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      À venir
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
