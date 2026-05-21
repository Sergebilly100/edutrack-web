import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCircle2, ChevronRight, CircleX, ClipboardCheck, Flag, GraduationCap, MapPin, RefreshCw, Users, Wallet } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchSchoolInfo } from "@/modules/onboarding/onboarding.api"
import { getStudentAbsenceStats, getTodayAbsences, type StudentAbsenceStat } from "@/modules/students/students.api"
import { getSalaryUnpaidAlerts } from "@/modules/salaries/salaries.api"
import {
  getAttendanceHistory,
  getCurrentMonthKey,
  getDashboardCounts,
  getSMSLog,
  getNextWeekCoverageState,
  getPreviousMonthKey,
  getSalarySummary,
  getTeacherCompliance,
  getTeacherTrendFromSummaries,
  getTodayAttendance,
  getTopRiskTeachers,
  getTotalPendingSalaries,
  type DashboardCourseItem,
  type DashboardSalarySummaryItem,
} from "@/modules/dashboard/dashboard.api"
import { getPendingValidationCount } from "@/modules/validations/validations.api"
import { EmptyState, emptyStateIcons } from "@/shared/components/EmptyState"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { SalaryRow } from "@/shared/components/SalaryRow"
import type { SalaryStatus } from "@/shared/components/SalaryRow"
import { StatCard } from "@/shared/components/StatCard"
import { WeekCoverageAlert } from "@/shared/components/WeekCoverageAlert"
import { NotificationsPanel, type NotificationPanelItem } from "@/shared/components/layout/NotificationsPanel"
import { DashboardStatsCards } from "./components/DashboardStatsCards"
import {
  buildDirectorDashboardNotifications,
  readDashboardDismissedNotificationIds,
  writeDashboardDismissedNotificationIds,
} from "@/shared/lib/dashboard-notifications"
import { useAuthStore } from "@/shared/store/auth.store"
import { getInitials } from "@/shared/utils/avatar"
import { formatFcfa } from "@/shared/utils/formatting"

const QUERY_STALE_TIME = 60_000
const TODAY_REFETCH_INTERVAL = 120_000
const formatToday = (value: Date) =>
  value.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

const formatHours = (value: string): string => {
  if (!value) {
    return "--:--"
  }

  if (/^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}


const buildCourseDateTime = (date: string, time: string): Date | null => {
  if (!date || !time) {
    return null
  }

  const normalizedTime = /^\d{2}:\d{2}/.test(time) ? time.slice(0, 8) : time
  const parsed = new Date(`${date}T${normalizedTime}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isPresentLikeCourse = (course: DashboardCourseItem): boolean =>
  course.status === "present" || course.status === "late" || course.status === "excused"

const hasCourseStartedFor15Minutes = (date: string, startTime: string, now: Date): boolean => {
  const startsAt = buildCourseDateTime(date, startTime)
  if (!startsAt) {
    return false
  }

  return now.getTime() - startsAt.getTime() >= 15 * 60 * 1000
}

const courseStatusMeta: Record<string, { label: string; className: string }> = {
  present: {
    label: "Présent",
    className: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200",
  },
  late: {
    label: "Retard",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200",
  },
  absent: {
    label: "Absent",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
  },
  default: {
    label: "En attente",
    className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
}


type DashboardSalaryRow = DashboardSalarySummaryItem & {
  salaryRowStatus: SalaryStatus
  salaryStatusLabel?: string
  salaryStatusClassName?: string
}

const toDashboardSalaryRow = (item: DashboardSalarySummaryItem): DashboardSalaryRow => {
  if (item.status === "Salaire fixe") {
    return {
      ...item,
      salaryRowStatus: "paid",
      salaryStatusLabel: "Salaire fixe",
      salaryStatusClassName: "border-slate-200 bg-slate-50 text-slate-700",
    }
  }

  if (item.status !== "disputed" && item.isPartiallyPaid) {
    return {
      ...item,
      salaryRowStatus: item.status === "pending" ? "pending" : "paid",
      salaryStatusLabel: "Payé partiellement",
      salaryStatusClassName: "border-amber-200 bg-amber-50 text-amber-700",
    }
  }

  if (item.status === "nothing_to_pay") {
    return {
      ...item,
      salaryRowStatus: "nothing_to_pay",
      salaryStatusLabel: "Rien à payer",
      salaryStatusClassName: "border-slate-200 bg-slate-50 text-slate-700",
    }
  }

  return {
    ...item,
    salaryRowStatus: item.status,
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-60 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

function TodayPresenceList({
  courses,
  expanded,
  date,
}: {
  courses: DashboardCourseItem[]
  expanded: boolean
  date: string
}) {
  const now = new Date()
  const sortedCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      const aTime = buildCourseDateTime(date, a.startTime)?.getTime() ?? 0
      const bTime = buildCourseDateTime(date, b.startTime)?.getTime() ?? 0
      return bTime - aTime
    })
  }, [courses, date])
  const visibleCourses = expanded ? sortedCourses : sortedCourses.slice(0, 5)

  if (sortedCourses.length === 0) {
    return (
      <EmptyState
        icon={emptyStateIcons.noCourses}
        title="Aucun créneau aujourd'hui"
        message="Aucun cours n'est planifié aujourd'hui. Vérifiez l'emploi du temps si une classe devait avoir cours."
      />
    )
  }

  return (
    <div className="space-y-2" data-testid="dashboard-today-presence-list">
      {visibleCourses.map((course) => {
        const status = courseStatusMeta[course.status ?? "default"] ?? courseStatusMeta.default
        const presentLike = isPresentLikeCourse(course)
        const showPointageBadge = presentLike && hasCourseStartedFor15Minutes(date, course.startTime, now)
        const roomStatusClassName = course.roomMismatch
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
        const pointageStatusClassName = course.studentRollcallDone
          ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200"
          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        const endTimeStatusClassName = course.roomScanEndAt
          ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200"
          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        return (
          <div
            key={course.id}
            className="animate-fade-in rounded-lg border border-border p-3 transition hover:bg-muted/40"
            data-testid="dashboard-presence-row"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{course.teacherName}</p>
                <p className="truncate text-sm text-muted-foreground">{course.subject} • {course.className}</p>
              </div>
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatHours(course.startTime)} - {formatHours(course.endTime)} • {course.roomName}
            </p>
            {presentLike ? (
              <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2" data-testid="dashboard-presence-badges">
                <Badge variant="outline" className={`max-w-full gap-1 px-2 py-1 text-[11px] leading-none ${roomStatusClassName}`}>
                  {course.roomMismatch ? <CircleX className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{course.roomMismatch ? "Salle incorrecte" : "Salle correcte"}</span>
                </Badge>
                {showPointageBadge ? (
                  <Badge variant="outline" className={`max-w-full gap-1 px-2 py-1 text-[11px] leading-none ${pointageStatusClassName}`}>
                    {course.studentRollcallDone ? <ClipboardCheck className="h-3 w-3 shrink-0" /> : <CircleX className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{course.studentRollcallDone ? "Pointage effectué" : "Pointage non effectué"}</span>
                  </Badge>
                ) : null}
                <Badge variant="outline" className={`max-w-full gap-1 px-2 py-1 text-[11px] leading-none ${endTimeStatusClassName}`}>
                  {course.roomScanEndAt ? <Flag className="h-3 w-3 shrink-0" /> : <CircleX className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{course.roomScanEndAt ? "Heure de fin spécifiée" : "Heure de fin non spécifiée"}</span>
                </Badge>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

type TodayStudentAbsenceItem = {
  studentId: string
  studentName: string
  className: string
  createdAt: string
  smsStatus: "queued" | "sent" | "failed" | "delivered" | null
}

function TodayStudentAbsenceList({
  items,
  onOpenStudent,
  expanded,
}: {
  items: TodayStudentAbsenceItem[]
  onOpenStudent: (studentId: string) => void
  expanded: boolean
}) {
  const visibleItems = expanded ? items : items.slice(0, 5)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={emptyStateIcons.allGood}
        title="Aucune absence aujourd'hui"
        message="Aucun élève n'a été marqué absent pour le moment. Les nouvelles absences apparaîtront ici en temps réel."
      />
    )
  }

  const statusClass = (status: TodayStudentAbsenceItem["smsStatus"]) => {
    if (status === "sent" || status === "delivered") {
      return "border-green-200 bg-green-50 text-green-700"
    }
    if (status === "failed") {
      return "border-amber-200 bg-amber-50 text-amber-700"
    }
    return "border-red-200 bg-red-50 text-red-700"
  }

  const statusLabel = (status: TodayStudentAbsenceItem["smsStatus"]) => {
    if (status === "sent" || status === "delivered") {
      return "Notifié"
    }
    if (status === "failed") {
      return "Échec"
    }
    return "Non notifié"
  }

  return (
    <div className="space-y-2">
      {visibleItems.map((item) => (
        <Button
          key={`${item.studentId}-${item.createdAt}`}
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start rounded-lg border border-border p-3"
          onClick={() => onOpenStudent(item.studentId)}
        >
          <div className="flex w-full items-center justify-between gap-2 text-left">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.studentName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.className} • {new Date(item.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <Badge variant="outline" className={statusClass(item.smsStatus)}>
              {statusLabel(item.smsStatus)}
            </Badge>
          </div>
        </Button>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshSuccess, setRefreshSuccess] = useState(false)
  const [showAllTodayPresence, setShowAllTodayPresence] = useState(false)
  const [showAllTodayStudentAbsences, setShowAllTodayStudentAbsences] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(readDashboardDismissedNotificationIds)
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const currentMonth = useMemo(() => getCurrentMonthKey(new Date()), [])
  const previousMonth = useMemo(() => getPreviousMonthKey(new Date()), [])
  const alertsRef = useRef<HTMLDivElement | null>(null)
  const isDirector = user?.role === "director"
  const canViewSalary = isDirector || permissions.includes("salary.view")
  const canViewStudents = isDirector || permissions.includes("students.view")

  const todayQuery = useQuery({
    queryKey: ["dashboard", "today-v3"],
    queryFn: getTodayAttendance,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: TODAY_REFETCH_INTERVAL,
    retry: false,
    enabled: isDirector,
  })

  const countsQuery = useQuery({
    queryKey: ["dashboard", "counts-v3"],
    queryFn: getDashboardCounts,
    staleTime: QUERY_STALE_TIME,
    retry: false,
  })

  const historyQuery = useQuery({
    queryKey: ["dashboard", "history-v3", 7],
    queryFn: () => getAttendanceHistory(7),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: isDirector,
  })

  const coverageQuery = useQuery({
    queryKey: ["dashboard", "coverage-v3"],
    queryFn: getNextWeekCoverageState,
    staleTime: QUERY_STALE_TIME,
    retry: false,
  })

  const salarySummaryQuery = useQuery({
    queryKey: ["dashboard", "salary-summary-v3", currentMonth],
    queryFn: () => getSalarySummary(currentMonth),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: canViewSalary,
  })

  const salaryUnpaidAlertsQuery = useQuery({
    queryKey: ["dashboard", "salary-unpaid-alerts", currentMonth],
    queryFn: () => getSalaryUnpaidAlerts(currentMonth),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: canViewSalary,
  })

  const smsLogQuery = useQuery({
    queryKey: ["dashboard", "sms-log", "notifications"],
    queryFn: () => getSMSLog(8),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: isDirector,
  })

  const previousSalarySummaryQuery = useQuery({
    queryKey: ["dashboard", "salary-summary-v3", previousMonth],
    queryFn: () => getSalarySummary(previousMonth),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: canViewSalary,
  })

  const riskTeachersQuery = useQuery({
    queryKey: ["dashboard", "risk-teachers-v3", currentMonth],
    queryFn: () => getTopRiskTeachers(currentMonth),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: canViewSalary,
  })

  const schoolQuery = useQuery({
    queryKey: ["dashboard", "school-v3"],
    queryFn: fetchSchoolInfo,
    staleTime: QUERY_STALE_TIME,
    retry: false,
  })

  const teacherComplianceQuery = useQuery({
    queryKey: ["dashboard", "teacher-compliance", currentMonth],
    queryFn: () => getTeacherCompliance(currentMonth),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: isDirector,
  })

  const validationCountQuery = useQuery({
    queryKey: ["validations", "pending", "count", "dashboard"],
    queryFn: getPendingValidationCount,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: 5 * 60_000,
    retry: false,
    enabled: isDirector,
  })

  const todayStudentAbsencesQuery = useQuery({
    queryKey: ["dashboard", "today-student-absences"],
    queryFn: getTodayAbsences,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: TODAY_REFETCH_INTERVAL,
    retry: false,
    enabled: isDirector,
  })

  const currentMonthRange = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const today = new Date()
    return {
      from: start.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    }
  }, [])

  const riskStudentsQuery = useQuery({
    queryKey: ["dashboard", "risk-students", currentMonthRange.from, currentMonthRange.to],
    queryFn: () =>
      getStudentAbsenceStats({
        from: currentMonthRange.from,
        to: currentMonthRange.to,
        minAbsences: 1,
      }),
    staleTime: QUERY_STALE_TIME,
    refetchInterval: TODAY_REFETCH_INTERVAL,
    retry: false,
    enabled: canViewStudents,
  })

  const isInitialLoading =
    todayQuery.isLoading ||
    countsQuery.isLoading ||
    historyQuery.isLoading ||
    coverageQuery.isLoading ||
    salarySummaryQuery.isLoading ||
    previousSalarySummaryQuery.isLoading ||
    riskTeachersQuery.isLoading ||
    schoolQuery.isLoading ||
    todayStudentAbsencesQuery.isLoading ||
    riskStudentsQuery.isLoading

  const weeklyAbsenceCount = useMemo(() => {
    return (historyQuery.data ?? []).reduce((acc, row) => acc + row.absentCount, 0)
  }, [historyQuery.data])

  const pendingSalaries = useMemo(() => {
    if (!salarySummaryQuery.data) {
      return { totalFcfa: 0, count: 0 }
    }

    return getTotalPendingSalaries(salarySummaryQuery.data)
  }, [salarySummaryQuery.data])

  const teacherTrend = useMemo(() => {
    if (!salarySummaryQuery.data || !previousSalarySummaryQuery.data) {
      return 0
    }

    return getTeacherTrendFromSummaries(salarySummaryQuery.data, previousSalarySummaryQuery.data)
  }, [salarySummaryQuery.data, previousSalarySummaryQuery.data])

  const presentRate = useMemo(() => {
    const presentCount = todayQuery.data?.presentCount ?? 0
    const totalCount = (todayQuery.data?.courses ?? []).length

    if (totalCount === 0) {
      return 0
    }

    return (presentCount / totalCount) * 100
  }, [todayQuery.data])

  const presenceVariant: "success" | "warning" | "danger" =
    presentRate >= 90 ? "success" : presentRate >= 70 ? "warning" : "danger"

  const salaryRows = useMemo(() => {
    const items = salarySummaryQuery.data?.items ?? []

    return items.map((item) => toDashboardSalaryRow(item)).slice(0, 5)
  }, [salarySummaryQuery.data])
  const salaryRealHoursTotals = useMemo(() => {
    return salaryRows.reduce(
      (acc, row) => {
        acc.planned += row.hoursPlanned
        acc.done += row.hoursDone
        acc.impact += Math.round((row.hoursDone - row.hoursPlanned) * (row.hourlyRate ?? 0))
        return acc
      },
      { planned: 0, done: 0, impact: 0 }
    )
  }, [salaryRows])

  const schoolName = schoolQuery.data?.name?.trim() || "École"
  const riskMonthStart = `${currentMonth}-01`
  const riskMonthEnd = new Date(
    Number(currentMonth.slice(0, 4)),
    Number(currentMonth.slice(5, 7)),
    0
  )
    .toISOString()
    .slice(0, 10)
  const riskTeachersLink =
    `/teachers?tab=analyse&run=1&from=${riskMonthStart}&to=${riskMonthEnd}&status_filter=absent`
  const riskStudentsLink =
    `/students?tab=absences&run=1&from=${currentMonthRange.from}&to=${currentMonthRange.to}&min_absences=1`

  const todayStudentAbsenceItems = useMemo<TodayStudentAbsenceItem[]>(() => {
    return (todayStudentAbsencesQuery.data ?? [])
      .flatMap((group) =>
        group.absences.map((absence) => ({
          studentId: absence.studentId,
          studentName: `${absence.studentLastName} ${absence.studentFirstName}`.trim(),
          className: group.className,
          createdAt: absence.createdAt,
          smsStatus: absence.smsStatus,
        }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [todayStudentAbsencesQuery.data])

  const topRiskStudents = useMemo<StudentAbsenceStat[]>(
    () =>
      [...(riskStudentsQuery.data ?? [])]
        .sort((a, b) => b.absenceCount - a.absenceCount)
        .slice(0, 5),
    [riskStudentsQuery.data]
  )
  const canToggleTodayPresence = (todayQuery.data?.courses ?? []).length > 5
  const canToggleTodayStudentAbsences = todayStudentAbsenceItems.length > 5
  const notificationItems = useMemo<NotificationPanelItem[]>(() => {
    return buildDirectorDashboardNotifications({
      nextWeekHasCoverage: coverageQuery.data?.nextWeekHasCoverage,
      weeklyAbsenceCount,
      salaryUnpaidCount: salaryUnpaidAlertsQuery.data?.count ?? 0,
      salaryUnpaidTotalFcfa: salaryUnpaidAlertsQuery.data?.totalRemainingFcfa ?? 0,
      pendingValidationCount: validationCountQuery.data?.total ?? 0,
      smsLog: smsLogQuery.data ?? [],
    })
  }, [
    coverageQuery.data?.nextWeekHasCoverage,
    salaryUnpaidAlertsQuery.data?.count,
    salaryUnpaidAlertsQuery.data?.totalRemainingFcfa,
    smsLogQuery.data,
    validationCountQuery.data?.total,
    weeklyAbsenceCount,
  ])
  const visibleNotifications = useMemo(
    () => notificationItems.filter((item) => !dismissedNotificationIds.has(item.id)),
    [dismissedNotificationIds, notificationItems]
  )
  const visibleNotificationIds = useMemo(
    () => new Set(visibleNotifications.map((item) => item.id)),
    [visibleNotifications]
  )
  const activeAlertsCount = visibleNotifications.length
  const dismissNotification = useCallback((id: string) => {
    setDismissedNotificationIds((current) => {
      const next = new Set(current)
      next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    writeDashboardDismissedNotificationIds(dismissedNotificationIds)
  }, [dismissedNotificationIds])

  useEffect(() => {
    const state = location.state as { openNotifications?: boolean } | null
    if (!state?.openNotifications) {
      return
    }

    setNotificationsOpen(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (!refreshSuccess) return
    const timer = window.setTimeout(() => setRefreshSuccess(false), 1200)
    return () => window.clearTimeout(timer)
  }, [refreshSuccess])

  const handleDashboardRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true)
      setRefreshSuccess(false)
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      await Promise.all([
        todayQuery.refetch(),
        countsQuery.refetch(),
        historyQuery.refetch(),
        coverageQuery.refetch(),
        salarySummaryQuery.refetch(),
        previousSalarySummaryQuery.refetch(),
        riskTeachersQuery.refetch(),
        teacherComplianceQuery.refetch(),
        validationCountQuery.refetch(),
        schoolQuery.refetch(),
        todayStudentAbsencesQuery.refetch(),
        riskStudentsQuery.refetch(),
      ])
      setRefreshSuccess(true)
    } finally {
      setIsRefreshing(false)
    }
  }, [
    countsQuery,
    coverageQuery,
    historyQuery,
    previousSalarySummaryQuery,
    queryClient,
    riskStudentsQuery,
    riskTeachersQuery,
    salarySummaryQuery,
    schoolQuery,
    teacherComplianceQuery,
    todayQuery,
    todayStudentAbsencesQuery,
    validationCountQuery,
  ])

  const dispatchMobileHeaderState = useCallback(() => {
    const detail = {
      activeAlertsCount,
      isRefreshing,
    }
    window.__edutrackDashboardMobileHeaderState = detail
    window.dispatchEvent(new CustomEvent("dashboard:mobile-header-state", { detail }))
  }, [activeAlertsCount, isRefreshing])

  useEffect(() => {
    dispatchMobileHeaderState()
  }, [dispatchMobileHeaderState])

  useEffect(() => {
    const onMobileRefresh = () => {
      void handleDashboardRefresh()
    }
    const onMobileToggleNotifications = () => {
      setNotificationsOpen((current) => !current)
    }
    const onMobileHeaderRequest = () => {
      dispatchMobileHeaderState()
    }

    window.addEventListener("dashboard:mobile-refresh", onMobileRefresh)
    window.addEventListener("dashboard:mobile-toggle-notifications", onMobileToggleNotifications)
    window.addEventListener("dashboard:mobile-header-request", onMobileHeaderRequest)

    return () => {
      window.removeEventListener("dashboard:mobile-refresh", onMobileRefresh)
      window.removeEventListener("dashboard:mobile-toggle-notifications", onMobileToggleNotifications)
      window.removeEventListener("dashboard:mobile-header-request", onMobileHeaderRequest)
      const detail = {
        activeAlertsCount: 0,
        isRefreshing: false,
      }
      window.__edutrackDashboardMobileHeaderState = detail
      window.dispatchEvent(new CustomEvent("dashboard:mobile-header-state", { detail }))
    }
  }, [dispatchMobileHeaderState, handleDashboardRefresh])

  const priorityActions = [
    weeklyAbsenceCount > 3 && visibleNotificationIds.has("teacher-absences-week")
      ? {
          id: "teacher-absences-week",
          title: "Absences profs élevées",
          message: `${weeklyAbsenceCount} absence(s) sur les 7 derniers jours.`,
          actionLabel: "Ouvrir les professeurs",
          onClick: () => navigate("/teachers"),
          onDismiss: () => dismissNotification("teacher-absences-week"),
          icon: Users,
          className: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
        }
      : null,
    (salaryUnpaidAlertsQuery.data?.count ?? 0) > 0 && visibleNotificationIds.has("salary-unpaid-alerts")
      ? {
          id: "salary-unpaid-alerts",
          title: "Salaires à terminer",
          message: `${salaryUnpaidAlertsQuery.data?.count ?? 0} fiche(s) en retard, ${new Intl.NumberFormat("fr-FR").format(salaryUnpaidAlertsQuery.data?.totalRemainingFcfa ?? 0)} FCFA à solder.`,
          actionLabel: "Ouvrir les salaires",
          onClick: () => navigate("/salaries"),
          onDismiss: () => dismissNotification("salary-unpaid-alerts"),
          icon: Wallet,
          className: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
        }
      : null,
    (validationCountQuery.data?.total ?? 0) > 0
      ? {
          id: "validations",
          title: "Validations en attente",
          message: `${validationCountQuery.data?.total ?? 0} décision(s) à prendre sur les pointages.`,
          actionLabel: "Ouvrir les validations",
          onClick: () => navigate("/validations"),
          onDismiss: null,
          icon: ClipboardCheck,
          className: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  if (isInitialLoading) {
    return (
      <>
        <OfflineIndicator />
        <DashboardSkeleton />
      </>
    )
  }

  return (
    <>
      <OfflineIndicator />

      <div className={`space-y-6 animate-fade-in rounded-lg ${refreshSuccess ? "fresh-data-pulse" : ""}`}>
        <header className="-mx-4 border-b bg-background px-4 py-4 md:sticky md:top-0 md:z-30 md:-mx-6 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Bonjour, {user?.name ?? "Directeur"}</h1>
              <p className="text-sm text-muted-foreground">{formatToday(new Date())}</p>
              <Badge variant="outline" className="mt-1">{schoolName}</Badge>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Voir les notifications"
                onClick={() => setNotificationsOpen((current) => !current)}
                className="relative"
              >
                <Bell className="h-4 w-4" />
                {activeAlertsCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                    {activeAlertsCount}
                  </span>
                ) : null}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Mettre à jour les données"
                disabled={isRefreshing}
                onClick={() => {
                  void handleDashboardRefresh()
                }}
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                    Mise à jour...
                  </>
                ) : refreshSuccess ? (
                  <>
                    <CheckCircle2 className="mr-1 h-4 w-4 text-green-600" />
                    À jour
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Actualiser
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>

        {notificationsOpen ? (
          <NotificationsPanel
            notifications={visibleNotifications}
            onDismiss={dismissNotification}
            onDismissAll={() => setDismissedNotificationIds(new Set(notificationItems.map((item) => item.id)))}
            onClose={() => setNotificationsOpen(false)}
            onNavigate={(href) => {
              setNotificationsOpen(false)
              navigate(href)
            }}
          />
        ) : null}

        <section ref={alertsRef} className="space-y-3 animate-fade-in">
          <WeekCoverageAlert
            nextWeekHasCoverage={coverageQuery.data?.nextWeekHasCoverage ?? true}
            onNavigateToSchedule={() => navigate("/schedule")}
          />

          {priorityActions.length !== 0 ? (
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Priorités du jour</h2>
                  <p className="text-sm text-muted-foreground">Les décisions qui changent la journée ou la paie.</p>
                </div>
                {priorityActions.length === 0 ? (
                  <Badge variant="outline" className="w-fit border-green-200 bg-green-50 text-green-700">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Aucun blocage
                  </Badge>
                ) : null}
              </div>

              {priorityActions.length > 0 ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {priorityActions.map((item) => {
                    const Icon = item.icon
                    return (
                      <article key={item.id} className={`rounded-lg border p-3 ${item.className}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/70">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold">{item.title}</h3>
                            <p className="mt-1 text-sm opacity-90">{item.message}</p>
                          </div>
                          {item.onDismiss ? (
                            <button
                              type="button"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              aria-label={`Masquer ${item.title}`}
                              onClick={item.onDismiss}
                            >
                              <CircleX className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                        <Button type="button" variant="outline" className="mt-3 w-full bg-background/80" onClick={item.onClick}>
                          {item.actionLabel}
                        </Button>
                      </article>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null }
        </section>

        <DashboardStatsCards />

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg font-semibold">Présences professeurs aujourd'hui</CardTitle>
              {canToggleTodayPresence ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10"
                  onClick={() => setShowAllTodayPresence((current) => !current)}
                >
                  {showAllTodayPresence ? "Afficher moins" : "Afficher tout"}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <TodayPresenceList
                courses={todayQuery.data?.courses ?? []}
                expanded={showAllTodayPresence}
                date={todayQuery.data?.date ?? new Date().toISOString().slice(0, 10)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-semibold">Profs à risque</CardTitle>
              <Button asChild variant="outline" size="sm" className="min-h-10">
                <Link to={riskTeachersLink} data-testid="dashboard-risk-see-all">Voir tous</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {(riskTeachersQuery.data ?? []).length === 0 ? (
                <EmptyState
                  icon={emptyStateIcons.allGood}
                  title="Aucun profil à risque"
                  message="Aucun professeur ne dépasse le seuil d'alerte ce mois-ci."
                />
              ) : (
                <div className="space-y-2">
                  {(riskTeachersQuery.data ?? []).map((teacher) => (
                    <Button
                      key={teacher.teacherId}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start rounded-lg border border-border p-3"
                      onClick={() =>
                        navigate(
                          `/teachers/${teacher.teacherId}?returnTo=${encodeURIComponent(location.pathname + location.search)}`
                        )
                      }
                    >
                      <div className="animate-fade-in flex w-full items-center justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs font-semibold">{getInitials(teacher.teacherName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 text-left">
                            <p className="truncate text-sm font-medium">{teacher.teacherName}</p>
                            <p className="text-xs text-muted-foreground">
                              {teacher.absenceCount} absence(s) • {Math.round(teacher.attendanceRate)}% présence
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="order-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-semibold">Conformité profs ce mois</CardTitle>
              <Button asChild variant="outline" size="sm" className="min-h-10">
                <Link to="/teachers?tab=classement">Voir le classement complet</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {teacherComplianceQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : (teacherComplianceQuery.data ?? []).length === 0 ? (
                <EmptyState
                  icon={emptyStateIcons.noTeachers}
                  title="Aucun scan de fin"
                  message="Les taux apparaîtront dès que les cours seront terminés."
                />
              ) : (
                <div className="space-y-2">
                  {(teacherComplianceQuery.data ?? []).slice(0, 3).map((teacher) => (
                    <div
                      key={teacher.teacherId}
                      className="flex min-h-[48px] items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {teacher.rank}. {teacher.teacherName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {teacher.totalCheckouts}/{teacher.totalCheckins} cours
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          teacher.complianceRate >= 80
                            ? "border-green-200 bg-green-50 text-green-700"
                            : teacher.complianceRate < 30
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                        }
                      >
                        {Math.round(teacher.complianceRate)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="order-1">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-semibold">Validations en attente</CardTitle>
              <Button asChild variant="outline" size="sm" className="min-h-10">
                <Link to="/validations">Aller aux validations</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {validationCountQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : (validationCountQuery.data?.total ?? 0) === 0 ? (
                <EmptyState
                  icon={emptyStateIcons.allGood}
                  title="Aucune validation en attente"
                  message="Les présences GPS suspectes, les heures courtes et les scans de fin manquants apparaîtront ici."
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">GPS suspects</p>
                    <p className="mt-1 text-3xl font-bold">{validationCountQuery.data?.gps_suspicious ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Heures courtes</p>
                    <p className="mt-1 text-3xl font-bold">{validationCountQuery.data?.short_hours ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Scan de fin</p>
                    <p className="mt-1 text-3xl font-bold">{validationCountQuery.data?.missing_end_scan ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                    <p className="text-xs">Total</p>
                    <p className="mt-1 text-3xl font-bold">{validationCountQuery.data?.total ?? 0}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-semibold">Absences élèves aujourd'hui</CardTitle>
              {canToggleTodayStudentAbsences ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10"
                  onClick={() => setShowAllTodayStudentAbsences((current) => !current)}
                >
                  {showAllTodayStudentAbsences ? "Afficher moins" : "Afficher tout"}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <TodayStudentAbsenceList
                items={todayStudentAbsenceItems}
                onOpenStudent={(studentId) =>
                  navigate(
                    `/students/${studentId}?returnTo=${encodeURIComponent(
                      `${location.pathname}${location.search}`
                    )}`
                  )
                }
                expanded={showAllTodayStudentAbsences}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-semibold">Élèves à risque</CardTitle>
              <Button asChild variant="outline" size="sm" className="min-h-10">
                <Link to={riskStudentsLink}>Voir tous</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {topRiskStudents.length === 0 ? (
                <EmptyState
                  icon={emptyStateIcons.allGood}
                  title="Aucun élève à risque"
                  message="Aucun élève ne dépasse le seuil d'alerte ce mois-ci."
                />
              ) : (
                <div className="space-y-2">
                  {topRiskStudents.map((student) => (
                    <Button
                      key={student.studentId}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start rounded-lg border border-border p-3"
                      onClick={() =>
                        navigate(
                          `/students/${student.studentId}?returnTo=${encodeURIComponent(
                            `${location.pathname}${location.search}`
                          )}`
                        )
                      }
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="min-w-0 text-left">
                          <p className="truncate text-sm font-medium">{student.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.className} • {student.absenceCount} absence(s) • {(student.absenceRate ?? 0).toFixed(2)}%
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-semibold">Résumé salaires du mois</CardTitle>
              <Button asChild variant="outline" size="sm" className="min-h-10">
                <Link to="/salaries">Voir tous les salaires</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {/* // Affichage d'un résumé des heures planifiées vs effectuées si l'école utilise les heures réelles pour le calcul de la paie
              {schoolQuery.data?.use_real_hours === true ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                  Ce mois : {salaryRealHoursTotals.planned.toFixed(1)}h planifiées, {salaryRealHoursTotals.done.toFixed(1)}h réellement effectuées.
                  Écart : {(salaryRealHoursTotals.done - salaryRealHoursTotals.planned).toFixed(1)}h, impact estimé : {formatFcfa(salaryRealHoursTotals.impact)}.
                </div>
              ) : null} */}
              {salaryRows.length === 0 ? (
                <EmptyState
                  icon={emptyStateIcons.noTeachers}
                  title="Aucune fiche salaire"
                  message="Aucune ligne de salaire n'est disponible pour ce mois. Les fiches apparaîtront ici dès que des heures seront enregistrées."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Professeur</TableHead>
                        <TableHead>Progression</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaryRows.map((row) => (
                        <SalaryRow
                          key={row.teacherId}
                          teacher={{
                            id: row.teacherId,
                            name: row.teacherName,
                            type: row.teacherType,
                          }}
                          periodSummary={{
                            hoursDone: row.hoursDone,
                            hoursPlanned: row.hoursPlanned,
                            amountFcfa: row.totalFcfa ?? 0,
                            status: row.salaryRowStatus,
                            statusLabel: row.salaryStatusLabel,
                            statusClassName: row.salaryStatusClassName,
                            canMarkPaid:
                              Boolean(row.salaryRecordId) &&
                              row.hoursDone > 0 &&
                              (row.totalFcfa ?? 0) > 0 &&
                              (row.status === "pending" || (row.status === "paid" && row.isPartiallyPaid)),
                          }}
                          onMarkPaid={() => navigate("/salaries")}
                          onDetails={() => navigate("/salaries")}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}
