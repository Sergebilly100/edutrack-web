import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchSchoolInfo } from "@/modules/onboarding/onboarding.api"
import {
  getAttendanceHistory,
  getQRAlerts,
  getSMSLog,
  getTodayAttendance,
  type DashboardCourseItem,
} from "@/modules/dashboard/dashboard.api"
import AlertsList from "@/modules/dashboard/components/AlertsList"
import PresenceChart from "@/modules/dashboard/components/PresenceChart"
import QRAlertsList from "@/modules/dashboard/components/QRAlertsList"
import { AlertBanner } from "@/shared/components/AlertBanner"
import {
  AbsentIcon,
  PresentIcon,
  RefreshIcon,
  ScheduleIcon,
  SubjectIcon,
  WarningIcon,
} from "@/shared/components/icons"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { StatCard } from "@/shared/components/StatCard"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import { useTenant } from "@/shared/hooks/useTenant"

const formatDay = (value: Date) =>
  value.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

const formatHour = (value: string) => {
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

const formatMinutesAgo = (timestamp: number) => {
  const elapsedMs = Date.now() - timestamp
  const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / 60000))
  return `${elapsedMinutes} min`
}

const statusBadgeMeta: Record<string, { label: string; className: string }> = {
  present: { label: "Présent", className: "bg-green-100 text-green-700 border-green-200" },
  late: { label: "Retard", className: "bg-amber-100 text-amber-700 border-amber-200" },
  absent: { label: "Absent", className: "bg-red-100 text-red-700 border-red-200" },
  excused: { label: "Excusé", className: "bg-slate-100 text-slate-700 border-slate-200" },
  default: { label: "Non pointé", className: "bg-slate-100 text-slate-700 border-slate-200" },
}

const QR_ALERT_READ_STORAGE_KEY = "dashboard_qr_alert_read_ids"

const parseReadIds = (raw: string | null): Record<string, boolean> => {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) {
      return {}
    }

    const entries = Object.entries(parsed).filter((entry) => entry[1] === true)
    return Object.fromEntries(entries) as Record<string, boolean>
  } catch {
    return {}
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="space-y-2">
        <div className="h-6 w-44 animate-pulse rounded bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border bg-muted/50" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-md bg-muted/60" />
          ))}
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-md bg-muted/60" />
          ))}
        </div>
      </div>

      <div className="h-72 animate-pulse rounded-lg border bg-muted/50" />
    </div>
  )
}

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const tenant = useTenant()
  const { isOnline } = useNetworkStatus()
  const [selectedCourse, setSelectedCourse] = useState<DashboardCourseItem | null>(null)
  const [notificationsTab, setNotificationsTab] = useState<"sms" | "qr">("sms")
  const [qrReadIds, setQrReadIds] = useState<Record<string, boolean>>({})

  const todayQuery = useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: getTodayAttendance,
    refetchInterval: 2 * 60 * 1000,
  })

  const historyQuery = useQuery({
    queryKey: ["dashboard", "history", 7],
    queryFn: () => getAttendanceHistory(7),
    staleTime: 5 * 60 * 1000,
  })

  const smsQuery = useQuery({
    queryKey: ["dashboard", "sms", 10],
    queryFn: () => getSMSLog(10),
  })

  const qrAlertsQuery = useQuery({
    queryKey: ["dashboard", "qr-alerts", 20],
    queryFn: () => getQRAlerts(20),
  })

  const schoolQuery = useQuery({
    queryKey: ["school-info"],
    queryFn: fetchSchoolInfo,
  })

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    setQrReadIds(parseReadIds(window.localStorage.getItem(QR_ALERT_READ_STORAGE_KEY)))
  }, [])

  const markQrAlertAsRead = (id: string) => {
    setQrReadIds((current) => {
      if (current[id]) {
        return current
      }

      const next = {
        ...current,
        [id]: true,
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(QR_ALERT_READ_STORAGE_KEY, JSON.stringify(next))
      }

      return next
    })
  }

  const unreadTodayQrCount = useMemo(() => {
    return (qrAlertsQuery.data ?? []).filter((alert) => alert.isToday && !qrReadIds[alert.id]).length
  }, [qrAlertsQuery.data, qrReadIds])

  const isInitialLoading =
    todayQuery.isLoading || historyQuery.isLoading || smsQuery.isLoading || qrAlertsQuery.isLoading

  const hasAnyData =
    Boolean(todayQuery.data) ||
    Boolean(historyQuery.data?.length) ||
    Boolean(smsQuery.data?.length) ||
    Boolean(qrAlertsQuery.data?.length)

  const lastUpdatedAt = useMemo(() => {
    return Math.max(
      todayQuery.dataUpdatedAt,
      historyQuery.dataUpdatedAt,
      smsQuery.dataUpdatedAt,
      qrAlertsQuery.dataUpdatedAt
    )
  }, [
    todayQuery.dataUpdatedAt,
    historyQuery.dataUpdatedAt,
    smsQuery.dataUpdatedAt,
    qrAlertsQuery.dataUpdatedAt,
  ])

  const cacheAgeLabel =
    !isOnline && hasAnyData && lastUpdatedAt > 0
      ? `Données mises en cache il y a ${formatMinutesAgo(lastUpdatedAt)}`
      : null

  const schoolName = schoolQuery.data?.name?.trim() || tenant.schemaName || "École"

  const refreshDashboard = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "history"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "sms"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "qr-alerts"] }),
    ])

    await Promise.all([todayQuery.refetch(), historyQuery.refetch(), smsQuery.refetch(), qrAlertsQuery.refetch()])
  }

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

      <div className="space-y-6 animate-fade-in">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
              <p className="text-sm text-muted-foreground">{schoolName}</p>
              <p className="text-sm text-muted-foreground capitalize">{formatDay(new Date())}</p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refreshDashboard()
              }}
              disabled={
                todayQuery.isFetching ||
                historyQuery.isFetching ||
                smsQuery.isFetching ||
                qrAlertsQuery.isFetching
              }
            >
              <RefreshIcon
                className={`mr-2 h-4 w-4 ${(todayQuery.isFetching || historyQuery.isFetching || smsQuery.isFetching || qrAlertsQuery.isFetching) ? "animate-spin" : ""}`}
              />
              Actualiser
            </Button>
          </div>

          {cacheAgeLabel ? (
            <AlertBanner
              type="warning"
              title="Mode hors ligne"
              message={cacheAgeLabel}
            />
          ) : null}
        </header>

        <section className="space-y-3">
          {todayQuery.isError || historyQuery.isError || smsQuery.isError || qrAlertsQuery.isError ? (
            <AlertBanner
              type="error"
              title="Erreur de chargement"
              message="Certaines données du dashboard n'ont pas pu être chargées. Réessayez avec le bouton Actualiser."
            />
          ) : null}
          {unreadTodayQrCount > 0 ? (
            <AlertBanner
              type="info"
              title="Alertes QR en attente"
              message={`${unreadTodayQrCount} alerte(s) QR non lue(s) aujourd'hui.`}
              action={{
                label: "Voir les alertes",
                onClick: () => setNotificationsTab("qr"),
              }}
            />
          ) : null}
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Cours du jour"
            value={todayQuery.data?.courses.length ?? 0}
            subtitle="Créneaux planifiés"
            icon={<SubjectIcon className="h-4 w-4" />}
            variant="default"
            loading={todayQuery.isFetching && !todayQuery.data}
          />
          <StatCard
            title="Présents"
            value={todayQuery.data?.presentCount ?? 0}
            subtitle="Pointages confirmés"
            icon={<PresentIcon className="h-4 w-4" />}
            variant="success"
            loading={todayQuery.isFetching && !todayQuery.data}
          />
          <StatCard
            title="Non pointés"
            value={todayQuery.data?.unmarkedCount ?? 0}
            subtitle="À vérifier"
            icon={<WarningIcon className="h-4 w-4" />}
            variant="warning"
            loading={todayQuery.isFetching && !todayQuery.data}
          />
          <StatCard
            title="Absents"
            value={todayQuery.data?.absentCount ?? 0}
            subtitle="Signalements du jour"
            icon={<AbsentIcon className="h-4 w-4" />}
            variant="danger"
            loading={todayQuery.isFetching && !todayQuery.data}
          />
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Cours du jour</h2>

            {(todayQuery.data?.courses ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun cours planifié pour aujourd'hui.</p>
            ) : (
              <ul className="space-y-2">
                {todayQuery.data?.courses.map((course) => {
                  const status =
                    statusBadgeMeta[course.status ?? "default"] ?? statusBadgeMeta.default

                  return (
                    <li key={course.id}>
                      <button
                        type="button"
                        className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/50"
                        onClick={() => setSelectedCourse(course)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{course.subject}</p>
                            <p className="text-xs text-muted-foreground">{course.className}</p>
                          </div>
                          <Badge variant="outline" className={status.className}>
                            {status.label}
                          </Badge>
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <ScheduleIcon className="h-3.5 w-3.5" />
                          <span>
                            {formatHour(course.startTime)} - {formatHour(course.endTime)}
                          </span>
                          <Separator orientation="vertical" className="h-3" />
                          <span>{course.roomName}</span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <Tabs value={notificationsTab} onValueChange={(value) => setNotificationsTab(value as "sms" | "qr")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sms">SMS récents</TabsTrigger>
              <TabsTrigger value="qr" className="gap-2">
                Alertes QR
                {unreadTodayQrCount > 0 ? (
                  <Badge className="bg-red-600 text-white hover:bg-red-600">{unreadTodayQrCount}</Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sms">
              <AlertsList alerts={smsQuery.data ?? []} />
            </TabsContent>
            <TabsContent value="qr">
              <QRAlertsList
                alerts={qrAlertsQuery.data ?? []}
                readIds={qrReadIds}
                onMarkRead={markQrAlertAsRead}
              />
            </TabsContent>
          </Tabs>
        </section>

        <section>
          <PresenceChart data={historyQuery.data ?? []} />
        </section>
      </div>

      <Dialog open={Boolean(selectedCourse)} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCourse?.subject ?? "Détail du cours"}</DialogTitle>
            <DialogDescription>
              {selectedCourse?.className ?? "Classe"} · {selectedCourse?.roomName ?? "Salle"}
            </DialogDescription>
          </DialogHeader>

          {selectedCourse ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Créneau</span>
                <span>
                  {formatHour(selectedCourse.startTime)} - {formatHour(selectedCourse.endTime)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Statut</span>
                <span>{statusBadgeMeta[selectedCourse.status ?? "default"]?.label ?? "Non pointé"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Retard</span>
                <span>{selectedCourse.lateMinutes ?? 0} min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Scan salle</span>
                <span>{selectedCourse.roomScannedName ?? "Non scanné"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mismatch salle</span>
                <span>{selectedCourse.roomMismatch ? "Oui" : "Non"}</span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
