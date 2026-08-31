import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCircle2, CircleX, ClipboardCheck, Flag, Info, MapPin, RefreshCw } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchSchoolInfo } from "@/modules/onboarding/onboarding.api"
import { listSchoolYears, type SchoolYear } from "@/modules/academic/academic.api"
import {
  getAttendanceHistory,
  getDashboardCounts,
  getDashboardActionItems,
  resolveDashboardActionItem,
  getTodayAttendance,
  type DashboardCourseItem,
} from "@/modules/dashboard/dashboard.api"
import { EmptyState, emptyStateIcons } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { OfflineGuard } from "@/shared/components/OfflineGuard"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { NotificationsPanel, type NotificationPanelItem } from "@/shared/components/layout/NotificationsPanel"
import { actionItemToNotification } from "./dashboard-action-notifications"
import { useAuthStore } from "@/shared/store/auth.store"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { apiClient } from "@/shared/api/client"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { dashboardTourSteps } from "@/shared/lib/tour-steps"

const OverviewTab = lazy(() =>
  import("@/modules/dashboard/tabs/OverviewTab").then(m => ({ default: m.OverviewTab }))
)

import {
  QUERY_STALE_TIME,
  TODAY_REFETCH_INTERVAL,
  buildCourseDateTime,
  courseStatusMeta,
  formatHours,
  formatToday,
  hasCourseStartedFor15Minutes,
  isPresentLikeCourse,
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
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [schoolYearId, setSchoolYearId] = useState("")
  const [gradingPeriodId, setGradingPeriodId] = useState("")
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const studentLabels = useStudentLabels()
  const isDirector = user?.role === "director"
  const tour = useTourGuide("dashboard", isDirector)

  const canViewFinance = isDirector || permissions.includes("payments.view")
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
    enabled: canViewAttendance,
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
    enabled: canViewAttendance,
  })


  const schoolQuery = useQuery({
    queryKey: ["dashboard", "school-v3"],
    queryFn: fetchSchoolInfo,
    staleTime: QUERY_STALE_TIME,
    retry: false,
  })

  const schoolYearsQuery = useQuery({
    queryKey: ["academic", "school-years"],
    queryFn: listSchoolYears,
    staleTime: QUERY_STALE_TIME,
    retry: false,
  })

  const gradingPeriodsQuery = useQuery({
    queryKey: ["academic", "grading-periods", schoolYearId],
    queryFn: async () => {
      const response = await apiClient.get<{ gradingPeriods?: Array<{ id: string; schoolYearId?: string; school_year_id?: string; label: string; orderIndex?: number; order_index?: number; isCurrent?: boolean; isCompleted?: boolean }> }>("/grading-periods")
      return (response.data.gradingPeriods ?? []).filter((period) => (period.schoolYearId ?? period.school_year_id) === schoolYearId)
    },
    enabled: Boolean(schoolYearId),
    staleTime: QUERY_STALE_TIME,
    retry: false,
  })

  // Seules les données structurantes (en-tête + compteurs globaux) gatent le
  // skeleton plein écran. Chaque autre bloc gère son propre chargement / erreur
  // via QueryErrorState : une requête lente ou en échec ne doit pas bloquer
  // l'affichage des sections déjà prêtes.
  const isInitialLoading = countsQuery.isLoading || schoolQuery.isLoading

  const schoolName = schoolQuery.data?.name?.trim() || "École"
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

  useEffect(() => {
    if (schoolYearId || !schoolYearsQuery.data?.length) return
    setSchoolYearId((schoolYearsQuery.data.find((year) => year.status === "active") ?? schoolYearsQuery.data[0]).id)
  }, [schoolYearId, schoolYearsQuery.data])

  useEffect(() => {
    if (gradingPeriodId || !gradingPeriodsQuery.data?.length) return
    const current = gradingPeriodsQuery.data.find((period) => period.isCurrent)
    if (current) setGradingPeriodId(current.id)
  }, [gradingPeriodId, gradingPeriodsQuery.data])

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
        schoolQuery.refetch(),
      ])
      setRefreshSuccess(true)
    } finally {
      setIsRefreshing(false)
    }
  }, [
    countsQuery,
    historyQuery,
    queryClient,
    schoolQuery,
    todayQuery,
  ])

  const actionItemsQuery = useQuery({
    queryKey: ["dashboard", "action-items"],
    queryFn: getDashboardActionItems,
    enabled: isDirector || canViewValidations,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })

  const resolveItemMutation = useMutation({
    mutationFn: resolveDashboardActionItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "action-items"] })
    },
  })

  // La cloche et « Priorités du jour » dérivent strictement de la même liste
  // d'items ouverts. Une résolution serveur les retire des deux surfaces.
  const notificationItems = useMemo<NotificationPanelItem[]>(
    () => (actionItemsQuery.data ?? []).map(actionItemToNotification),
    [actionItemsQuery.data]
  )
  const activeAlertsCount = notificationItems.length
  const dismissNotification = useCallback((id: string) => {
    resolveItemMutation.mutate(id)
  }, [resolveItemMutation])
  const dismissAllNotifications = useCallback(() => {
    void Promise.all(notificationItems.map((item) => resolveItemMutation.mutateAsync(item.id)))
  }, [notificationItems, resolveItemMutation])

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

  const priorityActions = (actionItemsQuery.data ?? [])
    .filter((item) => canViewValidations || item.type !== "validations_pending")
    .map((item) => {
    const notification = actionItemToNotification(item)
    return {
      id: item.id,
      title: notification.title,
      message: notification.message,
      href: notification.targetHref ?? "/dashboard",
      tone: notification.tone,
    }
  })

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
              <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{schoolName}</Badge><Select value={schoolYearId} onValueChange={(value) => { setSchoolYearId(value); setGradingPeriodId("") }}><SelectTrigger className="min-h-10 w-[12.5rem]" aria-label="Année scolaire"><SelectValue placeholder="Année scolaire" /></SelectTrigger><SelectContent>{(schoolYearsQuery.data ?? []).map((year: SchoolYear) => <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>)}</SelectContent></Select>{gradingPeriodsQuery.data?.length ? <Select value={gradingPeriodId} onValueChange={setGradingPeriodId}><SelectTrigger className="min-h-10 w-[12.5rem]" aria-label="Période"><SelectValue placeholder="Période" /></SelectTrigger><SelectContent>{gradingPeriodsQuery.data.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}{period.isCurrent ? " · en cours" : period.isCompleted ? " · finalisée" : " · à venir"}</SelectItem>)}</SelectContent></Select> : null}</div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {isDirector ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
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
                  onClick={() => { void handleDashboardRefresh() }}
                  data-tour="dashboard-refresh"
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
            notifications={notificationItems}
            isLoading={actionItemsQuery.isLoading}
            isError={actionItemsQuery.isError}
            onDismiss={dismissNotification}
            onDismissAll={dismissAllNotifications}
            onClose={() => setNotificationsOpen(false)}
            onNavigate={(href) => {
              setNotificationsOpen(false)
              navigate(href)
            }}
          />
        ) : null}

        <Suspense fallback={<DashboardSkeleton />}>
          <OverviewTab
            canViewAttendance={canViewAttendance}
            canViewTeachers={canViewTeachers}
            canViewFinance={canViewFinance}
            historyData={historyQuery.data ?? []}
            todayCourses={todayQuery.data?.courses ?? []}
            todayDate={todayQuery.data?.date ?? new Date().toISOString().slice(0, 10)}
            schoolYearId={schoolYearId || undefined}
            gradingPeriodId={gradingPeriodId || undefined}
            priorityActions={priorityActions}
          />
        </Suspense>
      </div>
    </>
  )
}
