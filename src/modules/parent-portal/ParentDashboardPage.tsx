import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, UserRound, XCircle } from "lucide-react"
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

type TodayStatus = "clear" | "absent" | "upcoming" | "empty" | "unknown"

const statusCopy: Record<TodayStatus, { label: string; tone: string; message: string }> = {
  clear: {
    label: "Présence confirmée",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    message: "Aucune absence signalée sur les cours déjà passés.",
  },
  absent: {
    label: "Absence signalée",
    tone: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
    message: "Au moins une absence a été enregistrée aujourd'hui.",
  },
  upcoming: {
    label: "Cours à venir",
    tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    message: "Les présences seront visibles après le début des cours.",
  },
  empty: {
    label: "Aucun cours",
    tone: "border-border bg-muted/60 text-foreground",
    message: "Aucun créneau n'est programmé pour cette journée.",
  },
  unknown: {
    label: "Non renseigné",
    tone: "border-border bg-muted/60 text-foreground",
    message: "Les informations de présence ne sont pas encore complètes.",
  },
}

const slotStatusMeta = {
  absent: {
    label: "Absent",
    icon: XCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  present: {
    label: "Présent",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  upcoming: {
    label: "À venir",
    icon: Clock3,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  },
  unknown: {
    label: "Non renseigné",
    icon: AlertTriangle,
    className: "bg-muted text-muted-foreground",
  },
}

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
  const todayUnknownCount = todaySlots.filter((slot) => slot.status === "unknown").length
  const todayStatus: TodayStatus = useMemo(() => {
    if (todaySlots.length === 0) return "empty"
    if (todayAbsentCount > 0) return "absent"
    if (todayPresentCount > 0 && todayUnknownCount === 0) return "clear"
    if (todayUpcomingCount === todaySlots.length) return "upcoming"
    return "unknown"
  }, [todayAbsentCount, todayPresentCount, todaySlots.length, todayUnknownCount, todayUpcomingCount])
  const weekCoursesCount = useMemo(
    () => (scheduleQuery.data?.days ?? []).reduce((acc, day) => acc + day.slots.length, 0),
    [scheduleQuery.data]
  )
  const absenceRateMonth = Math.max(0, 100 - (statsQuery.data?.attendance_rate_month ?? 100))
  const latestAbsence = absencesQuery.data?.[0] ?? null
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
          message: `Votre abonnement expire dans ${daysRemaining} jour(s), le ${formatShortDate(
            subscriptionQuery.data?.ends_at ?? todayInBusinessTimezone()
          )}. Contactez l'administration pour le renouvellement.`,
        }
      : null

  if (studentsQuery.isLoading) {
    return <Skeleton className="h-24 w-full rounded-lg" />
  }

  return (
    <div className="space-y-5 text-base">
      <section className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Portail parent</p>
        <h1 className="text-2xl font-semibold tracking-normal">Suivi de présence</h1>
      </section>

      <section>
        {studentsQuery.isLoading ? (
          <Skeleton className="h-12 w-full rounded-lg" />
        ) : (studentsQuery.data?.length ?? 0) > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {(studentsQuery.data ?? []).map((student) => (
              <Button
                key={student.id}
                type="button"
                variant={selectedStudentId === student.id ? "default" : "ghost"}
                className="h-12 flex-shrink-0 rounded-lg px-3 text-sm"
                onClick={() => handleSelectStudent(student.id)}
              >
                <span className="max-w-[13rem] truncate">{student.first_name} {student.last_name}</span>
              </Button>
            ))}
          </div>
        ) : selectedStudent ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              {selectedStudent.first_name[0]}{selectedStudent.last_name[0]}
            </div>
            <div>
              <p className="text-sm font-semibold">{selectedStudent.first_name} {selectedStudent.last_name}</p>
              <p className="text-xs text-muted-foreground">{selectedStudent.class_name}</p>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] lg:items-start">
        <section className="space-y-3 rounded-lg border bg-card p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Aujourd'hui, {todayLabel}</p>
              <h2 className="mt-1 text-xl font-semibold">Présence du jour</h2>
            </div>
            <span className={cn("inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-xs font-semibold", statusCopy[todayStatus].tone)}>
              {statusCopy[todayStatus].label}
            </span>
          </div>

          {scheduleQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : todaySlots.length === 0 ? (
            <EmptyState title="Aucun cours aujourd'hui" message="Aucun créneau programmé pour cette journée." />
          ) : (
            <div className="space-y-2">
              {todaySlots.map((slot, index) => {
                const meta = slotStatusMeta[slot.status]
                const Icon = meta.icon
                return (
                  <div
                    key={`today-slot-${index}`}
                    className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-3"
                  >
                    <div className="flex min-h-11 items-center justify-center rounded-md bg-muted px-2 text-center">
                      <p className="text-xs font-semibold leading-tight text-muted-foreground">{slot.time}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{slot.subject}</p>
                      <p className="truncate text-xs text-muted-foreground">{slot.teacher} · {slot.room}</p>
                    </div>
                    <div className="shrink-0">
                      <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium", meta.className)}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-sm text-muted-foreground">{statusCopy[todayStatus].message}</p>
        </section>

        <aside className="space-y-3">
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

          <section className="rounded-lg border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Résumé</h2>
              <Link to="/parent/schedule" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                EDT
              </Link>
            </div>
            <div className="divide-y rounded-lg border">
              <div className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">Absences cette semaine</p>
                  <p className="text-xs text-muted-foreground">{weekCoursesCount} cours au programme</p>
                </div>
                {statsQuery.isLoading || scheduleQuery.isLoading ? (
                  <Skeleton className="h-6 w-10" />
                ) : (
                  <p className={cn("text-lg font-semibold tabular-nums", (statsQuery.data?.absences_this_week ?? 0) > 0 ? "text-red-600" : "text-emerald-600")}>
                    {statsQuery.data?.absences_this_week ?? 0}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">Taux d'absence ce mois</p>
                  <p className="text-xs text-muted-foreground">{statsQuery.data?.absences_this_month ?? 0} absence(s) enregistrée(s)</p>
                </div>
                {statsQuery.isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <p className={cn("text-lg font-semibold tabular-nums", absenceRateMonth > 20 ? "text-red-600" : "text-emerald-600")}>
                    {absenceRateMonth}%
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Dernière absence</p>
                  {absencesQuery.isLoading ? (
                    <Skeleton className="mt-1 h-4 w-36" />
                  ) : latestAbsence ? (
                    <p className="truncate text-xs text-muted-foreground">{latestAbsence.subject} · {formatDateFr(latestAbsence.date)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune absence récente</p>
                  )}
                </div>
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Dernières absences</h2>
              <Link to="/parent/absences" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Historique
              </Link>
            </div>
            {absencesQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : absencesQuery.data?.length ? (
              <div className="space-y-2">
                {absencesQuery.data.slice(0, 3).map((row, index) => (
                  <div
                    key={`${row.date}-${index}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{row.subject} · {row.time_label}</p>
                      <p className="text-xs text-muted-foreground">{formatDateFr(row.date)}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.teacher_name}</p>
                    </div>
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Aucune absence" message="Aucune absence récente pour cet élève." />
            )}
          </section>
        </aside>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/parent/schedule"
          className="flex min-h-16 items-center gap-3 rounded-lg border bg-card p-4 shadow-card transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Voir l'emploi du temps</p>
            <p className="text-xs text-muted-foreground">Semaine complète et créneaux à venir</p>
          </div>
        </Link>
        <Link
          to="/parent/account"
          className="flex min-h-16 items-center gap-3 rounded-lg border bg-card p-4 shadow-card transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserRound className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Mon compte</p>
            <p className="text-xs text-muted-foreground">Infos parent et abonnement</p>
          </div>
        </Link>
      </section>
    </div>
  )
}
