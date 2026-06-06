import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bell } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getSalaryUnpaidAlerts } from "@/modules/salaries/salaries.api"
import { getPendingValidationCount } from "@/modules/validations/validations.api"
import {
  getAttendanceHistory,
  getCurrentMonthKey,
  getNextWeekCoverageState,
  getSMSLog,
} from "@/modules/dashboard/dashboard.api"
import { NotificationsPanel, type NotificationPanelItem } from "@/shared/components/layout/NotificationsPanel"
import {
  buildDirectorDashboardNotifications,
  readDashboardDismissedNotificationIds,
  writeDashboardDismissedNotificationIds,
} from "@/shared/lib/dashboard-notifications"
import { useAuthStore } from "@/shared/store/auth.store"

type NotificationButtonProps = {
  count?: number
  className?: string
}

export function NotificationButton({ count = 0, className }: NotificationButtonProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(readDashboardDismissedNotificationIds)
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const currentMonth = useMemo(() => getCurrentMonthKey(new Date()), [])
  const isDashboardRoute = location.pathname === "/dashboard"
  const queryEnabled = user?.role === "director" && !isDashboardRoute
  const historyQuery = useQuery({
    queryKey: ["dashboard", "history-v3", 7],
    queryFn: () => getAttendanceHistory(7),
    staleTime: 60_000,
    retry: false,
    enabled: queryEnabled,
  })
  const coverageQuery = useQuery({
    queryKey: ["dashboard", "coverage-v3"],
    queryFn: getNextWeekCoverageState,
    staleTime: 60_000,
    retry: false,
    enabled: queryEnabled,
  })
  const salaryUnpaidAlertsQuery = useQuery({
    queryKey: ["dashboard", "salary-unpaid-alerts", currentMonth],
    queryFn: () => getSalaryUnpaidAlerts(currentMonth),
    staleTime: 60_000,
    retry: false,
    enabled: queryEnabled,
  })
  const validationCountQuery = useQuery({
    queryKey: ["validations", "pending", "count", "notifications"],
    queryFn: getPendingValidationCount,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
    enabled: queryEnabled,
  })
  const smsLogQuery = useQuery({
    queryKey: ["dashboard", "sms-log", "notifications"],
    queryFn: () => getSMSLog(8),
    staleTime: 60_000,
    retry: false,
    enabled: queryEnabled,
  })
  const weeklyAbsenceCount = useMemo(() => {
    return (historyQuery.data ?? []).reduce((acc, row) => acc + row.absentCount, 0)
  }, [historyQuery.data])
  const isLoading =
    historyQuery.isLoading ||
    coverageQuery.isLoading ||
    salaryUnpaidAlertsQuery.isLoading ||
    validationCountQuery.isLoading ||
    smsLogQuery.isLoading
  // Dégradation gracieuse, comme le Dashboard : une source en erreur ne doit pas
  // masquer les notifications issues des autres sources (chaque source a déjà un
  // fallback ?? 0 / ?? [] dans buildDirectorDashboardNotifications). On n'affiche
  // l'erreur globale que si TOUTES les requêtes échouent (auth/réseau), ce qui
  // évitait jusqu'ici le "Impossible de charger les notifications" déclenché par
  // une seule requête en échec sur les pages hors Dashboard.
  const isError =
    historyQuery.isError &&
    coverageQuery.isError &&
    salaryUnpaidAlertsQuery.isError &&
    validationCountQuery.isError &&
    smsLogQuery.isError
  const notificationItems = useMemo<NotificationPanelItem[]>(() => {
    return buildDirectorDashboardNotifications({
      nextWeekHasCoverage: coverageQuery.data?.nextWeekHasCoverage,
      weeklyAbsenceCount,
      salaryUnpaidCount: salaryUnpaidAlertsQuery.data?.count ?? 0,
      salaryUnpaidTotalFcfa: salaryUnpaidAlertsQuery.data?.totalRemainingFcfa ?? 0,
      pendingValidationCount: validationCountQuery.data?.total ?? 0,
      smsLog: smsLogQuery.data ?? [],
      // Ce bouton est réservé au directeur (queryEnabled + early return) :
      // toutes les capacités sont accordées.
      capabilities: {
        canViewSchedule: true,
        canViewTeachers: true,
        canViewValidations: true,
        canViewSalary: true,
        canViewSmsLog: true,
        canViewStudents: true,
      },
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
    () => notificationItems.filter((item) => !dismissedIds.has(item.id)),
    [dismissedIds, notificationItems]
  )
  const visibleCount = isDashboardRoute ? count : visibleNotifications.length

  useEffect(() => {
    setDismissedIds(readDashboardDismissedNotificationIds())
  }, [location.pathname])

  useEffect(() => {
    writeDashboardDismissedNotificationIds(dismissedIds)
  }, [dismissedIds])

  const dismissNotification = (id: string) => {
    setDismissedIds((current) => {
      const next = new Set(current)
      next.add(id)
      return next
    })
  }

  const dismissAllNotifications = () => {
    setDismissedIds(new Set(notificationItems.map((item) => item.id)))
  }

  if (user?.role !== "director") {
    return null
  }

  const handleClick = () => {
    if (isDashboardRoute) {
      window.dispatchEvent(new Event("dashboard:mobile-toggle-notifications"))
      return
    }

    setOpen(true)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Voir les notifications"
        onClick={handleClick}
        className={cn("relative h-9 w-9", className)}
      >
        <Bell className="h-4 w-4" />
        {visibleCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {visibleCount}
          </span>
        ) : null}
      </Button>

      {!isDashboardRoute ? (
        open ? (
          <NotificationsPanel
            notifications={visibleNotifications}
            isLoading={isLoading}
            isError={isError}
            onDismiss={dismissNotification}
            onDismissAll={dismissAllNotifications}
            onClose={() => setOpen(false)}
            onNavigate={(href) => {
              setOpen(false)
              navigate(href)
            }}
          />
        ) : null
      ) : null}
    </>
  )
}
