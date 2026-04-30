import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { XCircle } from "lucide-react"
import { Link } from "react-router-dom"

import { AlertBanner, EmptyState } from "@/shared/components"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  getParentAbsences,
  getParentSchedule,
  getParentStats,
  getParentSubscriptionStatus,
  listParentStudents,
} from "@/modules/parent-portal/parent.api"
import { currentIsoWeek, formatDateFr, formatShortDate } from "@/modules/parent-portal/parent.utils"
import { monthKeyInBusinessTimezone, todayInBusinessTimezone } from "@/shared/lib/business-date"

const SELECTED_STUDENT_STORAGE_KEY = "parent_selected_student_id"
const SUBSCRIPTION_ALERT_SEEN_KEY = "parent_subscription_alert_seen"

export default function ParentDashboardPage() {
  const studentsQuery = useQuery({
    queryKey: ["parent", "students"],
    queryFn: listParentStudents,
  })

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    () => sessionStorage.getItem(SELECTED_STUDENT_STORAGE_KEY) ?? ""
  )
  const [showSubscriptionAlert, setShowSubscriptionAlert] = useState(
    () => sessionStorage.getItem(SUBSCRIPTION_ALERT_SEEN_KEY) !== "1"
  )

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

  const subscriptionQuery = useQuery({
    queryKey: ["parent", "subscription-status"],
    queryFn: getParentSubscriptionStatus,
  })

  const statsQuery = useQuery({
    queryKey: ["parent", "stats", selectedStudentId],
    queryFn: () => getParentStats(selectedStudentId),
    enabled: selectedStudentId.length > 0,
  })

  const scheduleQuery = useQuery({
    queryKey: ["parent", "schedule", selectedStudentId, "today-widget", currentIsoWeek()],
    queryFn: () => getParentSchedule(selectedStudentId, currentIsoWeek()),
    enabled: selectedStudentId.length > 0,
  })

  const month = useMemo(() => monthKeyInBusinessTimezone(), [])

  const absencesQuery = useQuery({
    queryKey: ["parent", "latest-absences", selectedStudentId, month],
    queryFn: async () => {
      const rows = await getParentAbsences(selectedStudentId, month)
      return rows.slice(0, 5)
    },
    enabled: selectedStudentId.length > 0,
  })

  const selectedStudent = useMemo(
    () => (studentsQuery.data ?? []).find((item) => item.id === selectedStudentId) ?? null,
    [selectedStudentId, studentsQuery.data]
  )

  const today = todayInBusinessTimezone()
  const todaySlots = useMemo(() => {
    const day = (scheduleQuery.data?.days ?? []).find((item) => item.day === today)
    return day?.slots ?? []
  }, [scheduleQuery.data, today])

  const todayAbsentCount = todaySlots.filter((slot) => slot.status === "absent").length
  const todayPresentCount = todaySlots.filter((slot) => slot.status === "present").length
  const todayUpcomingCount = todaySlots.filter((slot) => slot.status === "upcoming").length
  const weekCoursesCount = useMemo(
    () => (scheduleQuery.data?.days ?? []).reduce((acc, day) => acc + day.slots.length, 0),
    [scheduleQuery.data]
  )
  const todayLabel = useMemo(() => {
    const date = new Date(`${today}T00:00:00.000Z`)
    const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(date)
    const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(date)
    const normalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace(".", "")
    return `${normalizedWeekday} ${dayMonth}`
  }, [today])

  const daysRemaining = subscriptionQuery.data?.days_remaining ?? 999
  const subscriptionAlert =
    daysRemaining <= 30
      ? {
          type: daysRemaining <= 7 ? "error" : "warning",
          message: `Votre abonnement expire dans ${daysRemaining} jours (le ${formatShortDate(
            subscriptionQuery.data?.ends_at ?? todayInBusinessTimezone()
          )}). Contactez l'établissement pour renouveler.`,
        }
      : null

  if (studentsQuery.isLoading) {
    return <Skeleton className="h-24 w-full rounded-lg" />
  }

  return (
    <div className="space-y-4 text-base">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Tableau de bord parent</h1>
      </section>

      <section>
        {studentsQuery.isLoading ? (
          <Skeleton className="h-10 w-full rounded-xl" />
        ) : (studentsQuery.data?.length ?? 0) > 1 ? (
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

      {subscriptionAlert && showSubscriptionAlert ? (
        <AlertBanner
          type={subscriptionAlert.type as "warning" | "error"}
          title="Alerte abonnement"
          message={subscriptionAlert.message}
          onDismiss={() => {
            setShowSubscriptionAlert(false)
            sessionStorage.setItem(SUBSCRIPTION_ALERT_SEEN_KEY, "1")
          }}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/60 p-4">
          <p className="text-xs text-muted-foreground">Cette semaine</p>
          {statsQuery.isLoading || scheduleQuery.isLoading ? (
            <Skeleton className="mt-1 h-8 w-20" />
          ) : (
            <p className={cn("mt-1 text-3xl font-semibold", (statsQuery.data?.absences_this_week ?? 0) > 0 ? "text-red-600" : "text-emerald-600")}>
              {statsQuery.data?.absences_this_week ?? 0}
            </p>
          )}
          <p className="text-xs text-muted-foreground">absence(s) / {weekCoursesCount} cours</p>
        </div>
        <div className="rounded-xl bg-muted/60 p-4">
          <p className="text-xs text-muted-foreground">Ce mois</p>
          {statsQuery.isLoading ? (
            <Skeleton className="mt-1 h-8 w-16" />
          ) : (
            <p className={cn("mt-1 text-3xl font-semibold", (statsQuery.data?.attendance_rate_month ?? 100) >= 80 ? "text-emerald-600" : "text-red-600")}>
              {statsQuery.data?.attendance_rate_month ?? 0}%
            </p>
          )}
          <p className="text-xs text-muted-foreground">taux de présence</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Aujourd'hui - {todayLabel}</h2>
        {scheduleQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : todaySlots.length === 0 ? (
          <EmptyState title="Aucun cours aujourd'hui" message="Aucun créneau programmé pour cette journée." />
        ) : (
          <div className="space-y-2">
            {todaySlots.map((slot, index) => (
              <div
                key={`today-slot-${index}`}
                className={cn(
                  "rounded-xl border p-3",
                  slot.status === "absent"
                    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                    : slot.status === "present"
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                      : "border-border bg-muted/40"
                )}
              >
                <p className="text-sm font-semibold">{slot.subject} · {slot.time}</p>
                <p className="text-xs text-muted-foreground">
                  {todayLabel} - {slot.teacher}
                </p>
                <div className="mt-2">
                  {slot.status === "absent" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      <XCircle className="h-3 w-3" /> Absent
                    </span>
                  )}
                  {slot.status === "present" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Présent
                    </span>
                  )}
                  {slot.status === "upcoming" && (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Cours à venir
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Dernières absences</h2>
        {absencesQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : absencesQuery.data?.length ? (
          <div className="space-y-2">
            {absencesQuery.data.map((row, index) => (
              <div
                key={`${row.date}-${index}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.subject} · {row.time_label}</p>
                  <p className="text-xs text-muted-foreground">{formatDateFr(row.date)}</p>
                  <p className="text-xs text-muted-foreground">{row.teacher_name}</p>
                </div>
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Aucune absence" message="Aucune absence récente pour cet élève." />
        )}

        <Link to="/parent/absences" className="inline-flex h-12 items-center text-base font-semibold text-primary underline-offset-4 hover:underline">
          Voir tout l'historique →
        </Link>
      </section>
    </div>
  )
}
