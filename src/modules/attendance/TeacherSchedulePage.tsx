import { useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { teacherScheduleApi, type ScheduleSlot } from "@/modules/attendance/attendance.api"
import CourseCard from "@/modules/attendance/components/CourseCard"
import DayPicker, { startOfWeekMonday, toDateKey } from "@/modules/attendance/components/DayPicker"
import TeacherCheckInFlow from "@/modules/attendance/components/TeacherCheckInFlow"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { CalendarIcon } from "@/shared/components/icons"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import { useAuthStore } from "@/shared/store/auth.store"

const getDayOfWeek = (date: Date) => {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

const formatDateRange = (start: Date, end: Date) => {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
  })

  return `${formatter.format(start)} au ${formatter.format(end)}`
}

const sortByTime = (left: ScheduleSlot, right: ScheduleSlot) =>
  `${left.start_time}-${left.end_time}`.localeCompare(`${right.start_time}-${right.end_time}`)

export default function TeacherSchedulePage() {
  const user = useAuthStore((state) => state.user)
  const { isOnline } = useNetworkStatus()

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null)

  const selectedDateKey = toDateKey(selectedDate)

  const scheduleQuery = useQuery({
    queryKey: ["teacher-schedule", "me"],
    queryFn: teacherScheduleApi.getMySchedule,
    refetchInterval: 60000,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })

  const attendanceQuery = useQuery({
    queryKey: ["teacher-attendance", selectedDateKey],
    queryFn: () => teacherScheduleApi.getMyAttendanceForDate(selectedDateKey),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })

  const attendanceBySchedule = useMemo(() => {
    return new Map((attendanceQuery.data ?? []).map((entry) => [entry.schedule_id, entry]))
  }, [attendanceQuery.data])

  const selectedDayOfWeek = getDayOfWeek(selectedDate)

  const daySlots = useMemo(() => {
    return (scheduleQuery.data ?? [])
      .filter((slot) => slot.day_of_week === selectedDayOfWeek)
      .map((slot) => ({ ...slot, date: selectedDateKey }))
      .sort(sortByTime)
  }, [scheduleQuery.data, selectedDateKey, selectedDayOfWeek])

  const highlightDates = useMemo(() => {
    const weekStart = startOfWeekMonday(selectedDate)
    const days = Array.from({ length: 5 }, (_, index) => {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + index)
      day.setHours(0, 0, 0, 0)
      return day
    })

    const daySet = new Set((scheduleQuery.data ?? []).map((slot) => slot.day_of_week))
    return days.filter((day) => daySet.has(getDayOfWeek(day)))
  }, [scheduleQuery.data, selectedDate])

  const weekStart = startOfWeekMonday(selectedDate)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 4)

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== "teacher") {
    return (
      <Alert variant="destructive">
        <AlertDescription>Cette page est réservée aux enseignants.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mon planning</h1>
        <p className="text-sm font-medium text-muted-foreground">Semaine du {formatDateRange(weekStart, weekEnd)}</p>
      </header>

      {!isOnline ? <OfflineIndicator forceState="offline" /> : <OfflineIndicator />}

      <DayPicker selectedDate={selectedDate} onChange={setSelectedDate} highlightDates={highlightDates} />

      {scheduleQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[108px] rounded-xl" />
          ))}
        </div>
      ) : null}

      {scheduleQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger votre planning pour le moment.</AlertDescription>
        </Alert>
      ) : null}

      {attendanceQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger vos statuts de pointage.</AlertDescription>
        </Alert>
      ) : null}

      {!scheduleQuery.isLoading && !scheduleQuery.isError && daySlots.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="Pas de cours ce jour"
          description="Sélectionnez un autre jour pour consulter votre planning."
        />
      ) : null}

      {!scheduleQuery.isLoading && daySlots.length > 0 ? (
        <ul className="space-y-3">
          {daySlots.map((slot) => (
            <CourseCard
              key={slot.id}
              slot={slot}
              attendance={attendanceBySchedule.get(slot.id)}
              onStartCourse={setActiveSlot}
            />
          ))}
        </ul>
      ) : null}

      {activeSlot ? (
        <TeacherCheckInFlow
          open={Boolean(activeSlot)}
          slot={activeSlot}
          onClose={() => {
            setActiveSlot(null)
          }}
        />
      ) : null}
    </div>
  )
}
