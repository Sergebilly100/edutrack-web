import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  Bell,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MinusCircle,
  PieChart,
  XCircle,
  CircleX 
} from "lucide-react"
import { Link } from "react-router-dom"

import { EmptyState } from "@/shared/components"
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
    label: "Présent",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    message: "Aucune absence signalée sur les cours déjà passés.",
  },
  absent: {
    label: "Absent",
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
    dotClassName: "bg-red-600 text-red-50",
    pillClassName: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  present: {
    label: "Présent",
    icon: CheckCircle2,
    dotClassName: "bg-emerald-600 text-emerald-50",
    pillClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  upcoming: {
    label: "À venir",
    icon: Clock3,
    dotClassName: "bg-amber-500 text-amber-950",
    pillClassName: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  },
  unknown: {
    label: "Non renseigné",
    icon: MinusCircle,
    dotClassName: "bg-slate-400 text-slate-50",
    pillClassName: "bg-muted text-muted-foreground",
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
    const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(date)
    const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date)
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${dayMonth}` 
  }, [today])
  const weeklyRangeLabel = useMemo(() => {
    const date = new Date(`${today}T00:00:00.000Z`)
    const day = date.getUTCDay() || 7
    const start = new Date(date)
    start.setUTCDate(date.getUTCDate() - (day - 1))
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 6)
    return `du ${formatShortDate(start.toISOString().slice(0, 10))} au ${formatShortDate(end.toISOString().slice(0, 10))}`
  }, [today])

  const daysRemaining = subscriptionQuery.data?.days_remaining ?? 999
  const subscriptionAlert =
    daysRemaining <= 30
      ? {
          type: daysRemaining <= 7 ? "error" : "warning",
          message: `rendez vous à l'administration de l'école pour le renouvellement.`,
        }
      : null

  if (studentsQuery.isLoading) {
    return <Skeleton className="h-28 w-full rounded-xl" />
  }

  return (
    <div className="space-y-3 text-base">
      <section>
        {(studentsQuery.data?.length ?? 0) > 1 ? (
          <div className="rounded-xl border bg-card p-2 shadow-card">
            <p className="mb-2 text-sm text-muted-foreground">Enfant sélectionné</p>
            <div className="flex gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch] justify-center">
              {(studentsQuery.data ?? []).map((student) => {
                const active = selectedStudentId === student.id
                return (
                  <Button
                    key={student.id}
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-auto min-w-[8.75rem] flex-shrink-0 justify-start gap-2.5 rounded-lg border px-3 py-2.5 text-left",
                      active ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary" : "border-transparent bg-muted/50"
                    )}
                    onClick={() => handleSelectStudent(student.id)}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", active ? "bg-primary-foreground/15" : "bg-primary/10 text-primary")}>
                      {student.last_name[0]} {student.first_name[0]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold leading-tight">{student.last_name} {student.first_name}</span>
                      <span className={cn("block text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{student.class_name}</span>
                    </span>
                  </Button>
                )
              })}
            </div>
          </div>
        ) : selectedStudent ? (
          <div className="flex items-center gap-3 rounded-xl border bg-card p-2 shadow-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {selectedStudent.last_name[0]} {selectedStudent.first_name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">Votre Enfant</p>
              <p className="truncate text-base font-semibold">{selectedStudent.last_name} {selectedStudent.first_name}</p>
              <p className="text-xs text-muted-foreground">{selectedStudent.class_name}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className={cn("border-b px-2 py-3 sm:px-4", todayStatus === "clear" ? "bg-emerald-50/70 dark:bg-emerald-950/20" : "bg-card")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:h-10 sm:w-10">
                <CalendarCheck2 className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold leading-tight sm:text-lg">Présence aujourd'hui</h1>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{todayLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {scheduleQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : todaySlots.length === 0 ? (
            <EmptyState title="Aucun cours aujourd'hui" message="Aucun créneau programmé pour cette journée." />
          ) : (
            <div className="relative">
              <div className="absolute bottom-6 left-[0.8rem] top-6 w-px bg-border sm:left-[4.25rem]" aria-hidden="true" />
              {todaySlots.map((slot, index) => {
                const meta = slotStatusMeta[slot.status]
                const Icon = meta.icon
                const [startTime, endTime] = slot.time.split("-").map((item) => item?.trim())
                return (
                  <div
                    key={`today-slot-${index}`}
                    className={cn("relative grid grid-cols-[2rem_3.7rem_minmax(0,1fr)_4.25rem] items-center gap-2 border-b py-[0.5625rem] last:border-b-0 sm:grid-cols-[3.75rem_1.85rem_minmax(0,1fr)_4.75rem]", index === 0 && "pt-0", index === todaySlots.length - 1 && "pb-0")}
                  >
                    <span className={cn("relative z-10 flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded-full shadow-sm sm:h-7 sm:w-7", meta.dotClassName)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="text-center">
                      <p className="text-xs font-semibold leading-tight text-foreground sm:text-sm">{startTime ?? slot.time}</p>
                      {endTime ? <p className="text-xs text-muted-foreground">- {endTime}</p> : null}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight sm:text-base">{slot.subject}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{slot.teacher} <span className="mx-1">·</span> {slot.room}</p>
                    </div>
                    <span className={cn("inline-flex justify-center items-center gap-1 rounded-md bg-red-100 px-0.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300", meta.pillClassName)}>
                      {meta.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{statusCopy[todayStatus].message}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="rounded-xl border bg-card p-3 shadow-card sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 sm:h-10 sm:w-10">
              <CalendarX2 className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs leading-snug text-muted-foreground">Absences cette semaine</p>
              {statsQuery.isLoading || scheduleQuery.isLoading ? (
                <Skeleton className="mt-2 h-7 w-14" />
              ) : (
                <p className={cn("mt-1 text-2xl font-semibold leading-none tabular-nums", (statsQuery.data?.absences_this_week ?? 0) > 0 ? "text-red-600" : "text-emerald-700")}>
                  {statsQuery.data?.absences_this_week ?? 0}
                </p>
              )}
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                <span className="sm:hidden">sur {weekCoursesCount} cours</span>
                <span className="hidden sm:inline">{weekCoursesCount} cours · {weeklyRangeLabel}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3 shadow-card sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 sm:h-10 sm:w-10">
              <PieChart className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs leading-snug text-muted-foreground">Taux d'absence ce mois</p>
              {statsQuery.isLoading ? (
                <Skeleton className="mt-2 h-7 w-16" />
              ) : (
                <p className={cn("mt-1 text-2xl font-semibold leading-none tabular-nums", absenceRateMonth > 20 ? "text-red-600" : "text-emerald-700")}>
                  {absenceRateMonth}%
                </p>
              )}
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                <span className="sm:hidden">{statsQuery.data?.absences_this_month ?? 0} absence(s)</span>
                <span className="hidden sm:inline">{statsQuery.data?.absences_this_month ?? 0} absence(s) enregistrée(s)</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {latestAbsence ? (
        <Link
          to="/parent/absences"
          className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-card transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300 sm:h-11 sm:w-11">
            <CalendarX2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground sm:text-sm">Dernière absence</p>
            <p className="truncate text-base font-semibold text-red-600">{formatDateFr(latestAbsence.date)}</p>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">{latestAbsence.subject} · {latestAbsence.time_label}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Aucune absence récente</p>
            <p className="text-xs text-muted-foreground">Aucune absence enregistrée pour cet élève sur la période.</p>
          </div>
        </div>
      )}

      {subscriptionAlert && showSubscriptionAlert ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950 shadow-card dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 sm:h-11 sm:w-11">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Abonnement bientôt expiré</p>
              <p className="mt-1 text-xs leading-snug sm:text-sm">{subscriptionAlert.message}</p>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:text-amber-100 dark:hover:bg-amber-900/40"
              onClick={() => {
                setShowSubscriptionAlert(false)
                sessionStorage.setItem(SUBSCRIPTION_ALERT_SEEN_KEY, "1")
              }}
              aria-label="Fermer l'alerte abonnement"
            >
              <CircleX className="h-5 w-5"/>
            </button>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <Link
          to="/parent/absences"
          className="flex items-center gap-3 border-b p-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <CalendarX2 className="h-[1.125rem] w-[1.125rem]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Historique des absences</p>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {selectedStudent ? `Consulter toutes les absences de ${selectedStudent.first_name}` : "Consulter toutes les absences"}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
        <Link
          to="/parent/schedule"
          className="flex items-center gap-3 p-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <CalendarClock className="h-[1.125rem] w-[1.125rem]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Emploi du temps (EDT)</p>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">Voir l'emploi du temps complet</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      </section>

      {/* <section className="rounded-xl border bg-card p-3.5 shadow-card sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Absences récentes</h2>
          <Link to="/parent/absences" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Voir tout <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {absencesQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : absencesQuery.data?.length ? (
          <div className="divide-y">
            {absencesQuery.data.slice(0, 3).map((row, index) => (
              <Link
                key={`${row.date}-${index}`}
                to="/parent/absences"
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <XCircle className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{formatDateFr(row.date)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{row.subject} · {row.time_label}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Aucune absence" message="Aucune absence récente pour cet élève." />
        )}
      </section> */}
    </div>
  )
}
