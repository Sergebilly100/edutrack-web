import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCircle2, ChevronRight, CircleX, ClipboardCheck, Flag, GraduationCap, Info, MapPin, RefreshCw, Users, Wallet } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchSchoolInfo } from "@/modules/onboarding/onboarding.api"
import { getStudentAbsenceStats, getTodayAbsences, type StudentAbsenceStat } from "@/modules/students/students.api"
import { getSalaryUnpaidAlerts } from "@/modules/salaries/salaries.api"
import { getCommissionOverdueAlerts } from "@/modules/subscriptions/subscriptions.api"
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
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { OfflineGuard } from "@/shared/components/OfflineGuard"
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
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { getInitials } from "@/shared/utils/avatar"
import { DashboardTabSkeleton } from "@/modules/dashboard/tabs/DashboardTabSkeleton"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { dashboardTourSteps } from "@/shared/lib/tour-steps"

const OverviewTab = lazy(() =>
  import("@/modules/dashboard/tabs/OverviewTab").then(m => ({ default: m.OverviewTab }))
)
const AttendanceTab = lazy(() =>
  import("@/modules/dashboard/tabs/AttendanceTab").then(m => ({ default: m.AttendanceTab }))
)
const SalariesTab = lazy(() =>
  import("@/modules/dashboard/tabs/SalariesTab").then(m => ({ default: m.SalariesTab }))
)
import { formatFcfa } from "@/shared/utils/formatting"
import { statusToneBadge } from "@/shared/utils/status-tone"

import {
  QUERY_STALE_TIME,
  TODAY_REFETCH_INTERVAL,
  buildCourseDateTime,
  courseStatusMeta,
  formatHours,
  formatToday,
  hasCourseStartedFor15Minutes,
  isPresentLikeCourse,
  toDashboardSalaryRow,
  type DashboardSalaryRow,
} from "./dashboard.helpers"

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

export function TodayPresenceList({
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
          : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
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

export type TodayStudentAbsenceItem = {
  studentId: string
  studentName: string
  className: string
  createdAt: string
  smsStatus: "queued" | "sent" | "failed" | "delivered" | null
}

export function TodayStudentAbsenceList({
  items,
  onOpenStudent,
  expanded,
}: {
  items: TodayStudentAbsenceItem[]
  onOpenStudent: (studentId: string) => void
  expanded: boolean
}) {
  const studentLabels = useStudentLabels()
  const visibleItems = expanded ? items : items.slice(0, 5)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={emptyStateIcons.allGood}
        title="Aucune absence aujourd'hui"
        message={`Aucun ${studentLabels.singularLower} n'a été marqué absent pour le moment. Les nouvelles absences apparaîtront ici en temps réel.`}
      />
    )
  }

  const statusClass = (status: TodayStudentAbsenceItem["smsStatus"]) => {
    if (status === "sent" || status === "delivered") {
      return "border-green-200 bg-green-50 text-green-700"
    }
    if (status === "failed") {
      return "border-amber-200 bg-amber-50 text-amber-900"
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
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "salaries">("overview")
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const studentLabels = useStudentLabels()
  const currentMonth = useMemo(() => getCurrentMonthKey(new Date()), [])
  const previousMonth = useMemo(() => getPreviousMonthKey(new Date()), [])
  const alertsRef = useRef<HTMLDivElement | null>(null)
  const isDirector = user?.role === "director"
  const tour = useTourGuide("dashboard", isDirector)

  const canViewSalary = isDirector || permissions.includes("salary.view")
  const canViewStudents = isDirector || permissions.includes("students.view")
  const canViewTeachers = isDirector || permissions.includes("teachers.view")
  const canViewAttendance = isDirector || permissions.includes("attendance.view")
  const canViewValidations = isDirector || permissions.includes("validations.view")
  const canViewSchedule = isDirector || permissions.includes("schedule.view")
  const canViewSubscriptions =
    isDirector ||
    permissions.includes("subscriptions.view") ||
    permissions.includes("subscriptions.revenue")

  const todayQuery = useQuery({
    queryKey: ["dashboard", "today-v3"],
    queryFn: getTodayAttendance,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: TODAY_REFETCH_INTERVAL,
    retry: false,
    enabled: canViewAttendance && (activeTab === "overview" || activeTab === "attendance"),
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
    enabled: canViewAttendance && activeTab === "overview",
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
    enabled: canViewSalary && (activeTab === "overview" || activeTab === "salaries"),
  })

  const salaryUnpaidAlertsQuery = useQuery({
    queryKey: ["dashboard", "salary-unpaid-alerts", currentMonth],
    queryFn: () => getSalaryUnpaidAlerts(currentMonth),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: canViewSalary && (activeTab === "overview" || activeTab === "salaries"),
  })

  const commissionOverdueAlertsQuery = useQuery({
    queryKey: ["dashboard", "commission-overdue-alerts"],
    queryFn: getCommissionOverdueAlerts,
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: isDirector,
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
    enabled: canViewSalary && activeTab === "overview",
  })

  const riskTeachersQuery = useQuery({
    queryKey: ["dashboard", "risk-teachers-v3", currentMonth],
    queryFn: () => getTopRiskTeachers(currentMonth),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: canViewTeachers && activeTab === "attendance",
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
    enabled: canViewTeachers && activeTab === "attendance",
  })

  const validationCountQuery = useQuery({
    queryKey: ["validations", "pending", "count", "dashboard"],
    queryFn: getPendingValidationCount,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: 5 * 60_000,
    retry: false,
    enabled: canViewValidations && (activeTab === "overview" || activeTab === "salaries"),
  })

  const todayStudentAbsencesQuery = useQuery({
    queryKey: ["dashboard", "today-student-absences"],
    queryFn: getTodayAbsences,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: TODAY_REFETCH_INTERVAL,
    retry: false,
    enabled: canViewStudents && activeTab === "attendance",
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
    enabled: canViewStudents && activeTab === "attendance",
  })

  // Seules les données structurantes (en-tête + compteurs globaux) gatent le
  // skeleton plein écran. Chaque autre bloc gère son propre chargement / erreur
  // via QueryErrorState : une requête lente ou en échec ne doit pas bloquer
  // l'affichage des sections déjà prêtes.
  const isInitialLoading = countsQuery.isLoading || schoolQuery.isLoading

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
      commissionOverdueCount: commissionOverdueAlertsQuery.data?.count ?? 0,
      commissionOverdueTotalFcfa: commissionOverdueAlertsQuery.data?.totalRemainingFcfa ?? 0,
      pendingValidationCount: validationCountQuery.data?.total ?? 0,
      smsLog: smsLogQuery.data ?? [],
      capabilities: {
        canViewSchedule,
        canViewTeachers,
        canViewValidations,
        canViewSalary,
        canViewSubscriptionRevenue: isDirector,
        canViewSmsLog: isDirector,
        canViewStudents,
      },
    })
  }, [
    coverageQuery.data?.nextWeekHasCoverage,
    salaryUnpaidAlertsQuery.data?.count,
    salaryUnpaidAlertsQuery.data?.totalRemainingFcfa,
    commissionOverdueAlertsQuery.data?.count,
    commissionOverdueAlertsQuery.data?.totalRemainingFcfa,
    smsLogQuery.data,
    validationCountQuery.data?.total,
    weeklyAbsenceCount,
    canViewSchedule,
    canViewTeachers,
    canViewValidations,
    canViewSalary,
    canViewStudents,
    isDirector,
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
          className: statusToneBadge.warning,
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
          className: statusToneBadge.warning,
        }
      : null,
    canViewValidations && (validationCountQuery.data?.total ?? 0) > 0
      ? {
          id: "validations",
          title: "Validations en attente",
          message: `${validationCountQuery.data?.total ?? 0} décision(s) à prendre sur les pointages.`,
          actionLabel: "Ouvrir les validations",
          onClick: () => navigate("/validations"),
          onDismiss: null,
          icon: ClipboardCheck,
          className: statusToneBadge.info,
        }
      : null,
    isDirector && (commissionOverdueAlertsQuery.data?.count ?? 0) > 0 && visibleNotificationIds.has("commission-overdue-alerts")
      ? {
          id: "commission-overdue-alerts",
          title: "Reversement commission en retard",
          message: `${commissionOverdueAlertsQuery.data?.count ?? 0} mois non soldé(s) - ${new Intl.NumberFormat("fr-FR").format(commissionOverdueAlertsQuery.data?.totalRemainingFcfa ?? 0)} FCFA à reverser à IvoirEdu.`,
          actionLabel: "Ouvrir les revenus",
          onClick: () => navigate("/subscriptions/revenue"),
          onDismiss: () => dismissNotification("commission-overdue-alerts"),
          icon: Wallet,
          className: statusToneBadge.danger,
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

  // Les deux requêtes structurantes ont échoué sans donnée en cache : on évite
  // une page squelette/vide et on propose une relance globale.
  if (
    countsQuery.isError &&
    schoolQuery.isError &&
    !countsQuery.data &&
    !schoolQuery.data
  ) {
    return (
      <>
        <OfflineIndicator />
        <div className="py-12">
          <QueryErrorState
            title="Tableau de bord indisponible"
            message="Impossible de charger les données du tableau de bord. Vérifiez votre connexion puis réessayez."
            isRetrying={countsQuery.isFetching || schoolQuery.isFetching}
            onRetry={() => {
              void countsQuery.refetch()
              void schoolQuery.refetch()
            }}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <OfflineIndicator />
      <TourGuide
        steps={dashboardTourSteps}
        run={tour.run}
        stepIndex={tour.stepIndex}
        onStepChange={tour.setStepIndex}
        onFinish={tour.markDone}
      />

      <div className={`space-y-6 animate-fade-in rounded-lg ${refreshSuccess ? "fresh-data-pulse" : ""}`}>
        <header className="-mx-4 border-b bg-background px-4 py-4 md:sticky md:top-0 md:z-30 md:-mx-6 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Bonjour, {user?.name ?? ""}</h1>
              <p className="text-sm text-muted-foreground">{formatToday(new Date())}</p>
              <Badge variant="outline" className="mt-1">{schoolName}</Badge>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {isDirector ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    setActiveTab("overview");
                    (document.scrollingElement ?? document.documentElement).scrollTo({ top: 0, behavior: "instant" })
                    tour.restart()
                  }}
                  aria-label="Revoir le tour guidé"
                >
                  <Info className="mr-1.5 h-4 w-4" />
                  Guide
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Voir les notifications"
                onClick={() => setNotificationsOpen((current) => !current)}
                className="relative"
                data-tour="dashboard-alerts"
              >
                <Bell className="h-4 w-4" />
                {activeAlertsCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                    {activeAlertsCount}
                  </span>
                ) : null}
              </Button>
              <OfflineGuard message="Actualisation indisponible hors ligne">
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
              </OfflineGuard>
              {/* Annonce l'état de l'actualisation aux lecteurs d'écran sans
                  voler le focus ni perturber l'affichage visuel. */}
              <span className="sr-only" role="status" aria-live="polite">
                {isRefreshing
                  ? "Mise à jour des données en cours"
                  : refreshSuccess
                    ? "Données à jour"
                    : ""}
              </span>
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
        </section>

        {/* Priorités du jour */}
        <section className="space-y-3">
          {priorityActions.length > 0 ? (
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  🔴 Priorités du jour ({priorityActions.length})
                </h2>
                <Badge variant="outline" className="hidden md:flex">
                  Urgent
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {priorityActions.map((item) => {
                  const Icon = item.icon
                  return (
                    <article
                      key={item.id}
                      className={`rounded-lg border p-3 ${item.className}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/70">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold">{item.title}</h3>
                          <p className="mt-1 text-sm opacity-90">{item.message}</p>
                        </div>
                        {item.onDismiss ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 hover:bg-background/70"
                            aria-label={`Masquer ${item.title}`}
                            onClick={item.onDismiss}
                          >
                            <CircleX className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 w-full bg-background/80"
                        onClick={item.onClick}
                      >
                        {item.actionLabel}
                      </Button>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : null}
        </section>

        {/* Tabs - STICKY */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="w-full"
        >
          <div className="sticky top-[64px] z-30 -mx-4 border-b bg-background px-4 py-3 shadow-sm md:top-[72px] md:-mx-6 md:px-6" data-tour="dashboard-tabs">
            <TabsList className="grid w-full grid-cols-3 gap-1 md:inline-flex md:w-auto">
            <TabsTrigger value="overview">
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="attendance" data-tour="dashboard-tab-attendance">
              Présences
              {todayQuery.data && todayQuery.data.absentCount > 0 ? (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                  {todayQuery.data.absentCount}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="salaries" data-tour="dashboard-tab-salaries">
              Salaires
              {pendingSalaries.count > 0 ? (
                <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">
                  {pendingSalaries.count}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="overview" className="mt-6 space-y-6">
            <Suspense fallback={<DashboardTabSkeleton />}>
              <OverviewTab
                canViewAttendance={canViewAttendance}
                canViewTeachers={canViewTeachers}
                canViewSalary={canViewSalary}
                canViewSubscriptions={canViewSubscriptions}
                weeklyAbsenceCount={weeklyAbsenceCount}
                nextWeekHasCoverage={coverageQuery.data?.nextWeekHasCoverage}
                historyData={historyQuery.data ?? []}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="attendance" className="mt-6 space-y-6">
            <Suspense fallback={<DashboardTabSkeleton />}>
              <AttendanceTab
                canViewAttendance={canViewAttendance}
                canViewTeachers={canViewTeachers}
                canViewStudents={canViewStudents}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="salaries" className="mt-6 space-y-6">
            <Suspense fallback={<DashboardTabSkeleton />}>
              <SalariesTab salarySummaryQuery={salarySummaryQuery} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

