import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCircle2, ChevronRight, GraduationCap, RefreshCw, Users, Wallet } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchSchoolInfo } from "@/modules/onboarding/onboarding.api"
import {
  getAttendanceHistory,
  getCurrentMonthKey,
  getDashboardCounts,
  getNextWeekCoverageState,
  getPreviousMonthKey,
  getSalarySummary,
  getTeacherTrendFromSummaries,
  getTodayAttendance,
  getTopRiskTeachers,
  getTotalPendingSalaries,
  type DashboardCourseItem,
} from "@/modules/dashboard/dashboard.api"
import { AlertBanner } from "@/shared/components/AlertBanner"
import { EmptyState, emptyStateIcons } from "@/shared/components/EmptyState"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { SalaryRow } from "@/shared/components/SalaryRow"
import type { SalaryStatus } from "@/shared/components/SalaryRow"
import { StatCard } from "@/shared/components/StatCard"
import { WeekCoverageAlert } from "@/shared/components/WeekCoverageAlert"
import { useAuthStore } from "@/shared/store/auth.store"

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

const formatFcfa = (amount: number): string => `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`

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

const getInitials = (name: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

const toSalaryStatus = (value: string): SalaryStatus | null => {
  if (value === "pending" || value === "paid" || value === "disputed") {
    return value
  }

  return null
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

function TodayPresenceList({ courses }: { courses: DashboardCourseItem[] }) {
  const sortedCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      const aTime = a.checkedInAt ? new Date(a.checkedInAt).getTime() : new Date(`1970-01-01T${a.startTime}`).getTime()
      const bTime = b.checkedInAt ? new Date(b.checkedInAt).getTime() : new Date(`1970-01-01T${b.startTime}`).getTime()
      return bTime - aTime
    })
  }, [courses])

  if (sortedCourses.length === 0) {
    return (
      <EmptyState
        icon={emptyStateIcons.noCourses}
        title="Aucun créneau aujourd'hui"
        message="Aucun cours n'est planifié pour la journée en cours."
      />
    )
  }

  return (
    <div className="space-y-2" data-testid="dashboard-today-presence-list">
      {sortedCourses.map((course) => {
        const status = courseStatusMeta[course.status ?? "default"] ?? courseStatusMeta.default
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
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshSuccess, setRefreshSuccess] = useState(false)
  const user = useAuthStore((state) => state.user)
  const currentMonth = useMemo(() => getCurrentMonthKey(new Date()), [])
  const previousMonth = useMemo(() => getPreviousMonthKey(new Date()), [])
  const alertsRef = useRef<HTMLDivElement | null>(null)

  const todayQuery = useQuery({
    queryKey: ["dashboard", "today-v3"],
    queryFn: getTodayAttendance,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: TODAY_REFETCH_INTERVAL,
  })

  const countsQuery = useQuery({
    queryKey: ["dashboard", "counts-v3"],
    queryFn: getDashboardCounts,
    staleTime: QUERY_STALE_TIME,
  })

  const historyQuery = useQuery({
    queryKey: ["dashboard", "history-v3", 7],
    queryFn: () => getAttendanceHistory(7),
    staleTime: QUERY_STALE_TIME,
  })

  const coverageQuery = useQuery({
    queryKey: ["dashboard", "coverage-v3"],
    queryFn: getNextWeekCoverageState,
    staleTime: QUERY_STALE_TIME,
  })

  const salarySummaryQuery = useQuery({
    queryKey: ["dashboard", "salary-summary-v3", currentMonth],
    queryFn: () => getSalarySummary(currentMonth),
    staleTime: QUERY_STALE_TIME,
  })

  const previousSalarySummaryQuery = useQuery({
    queryKey: ["dashboard", "salary-summary-v3", previousMonth],
    queryFn: () => getSalarySummary(previousMonth),
    staleTime: QUERY_STALE_TIME,
  })

  const riskTeachersQuery = useQuery({
    queryKey: ["dashboard", "risk-teachers-v3", currentMonth],
    queryFn: () => getTopRiskTeachers(currentMonth),
    staleTime: QUERY_STALE_TIME,
  })

  const schoolQuery = useQuery({
    queryKey: ["dashboard", "school-v3"],
    queryFn: fetchSchoolInfo,
    staleTime: QUERY_STALE_TIME,
  })

  const isInitialLoading =
    todayQuery.isLoading ||
    countsQuery.isLoading ||
    historyQuery.isLoading ||
    coverageQuery.isLoading ||
    salarySummaryQuery.isLoading ||
    previousSalarySummaryQuery.isLoading ||
    riskTeachersQuery.isLoading ||
    schoolQuery.isLoading

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

    return items
      .map((item) => {
        const status = toSalaryStatus(item.status)
        if (!status) {
          return null
        }

        return {
          ...item,
          status,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 5)
  }, [salarySummaryQuery.data])

  const activeAlertsCount =
    (coverageQuery.data?.nextWeekHasCoverage === false ? 1 : 0) + (weeklyAbsenceCount > 3 ? 1 : 0)

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

  useEffect(() => {
    if (!refreshSuccess) return
    const timer = window.setTimeout(() => setRefreshSuccess(false), 1200)
    return () => window.clearTimeout(timer)
  }, [refreshSuccess])

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
        <header className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-4 backdrop-blur md:top-0 md:-mx-6 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Bonjour, {user?.name ?? "Directeur"}</h1>
              <p className="text-sm capitalize text-muted-foreground">{formatToday(new Date())}</p>
              <Badge variant="outline" className="mt-1">{schoolName}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Voir les notifications"
                onClick={() => alertsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
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
                onClick={async () => {
                  try {
                    setIsRefreshing(true)
                    setRefreshSuccess(false)
                    await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
                    await Promise.all([
                      todayQuery.refetch(),
                      countsQuery.refetch(),
                      historyQuery.refetch(),
                      coverageQuery.refetch(),
                      salarySummaryQuery.refetch(),
                      previousSalarySummaryQuery.refetch(),
                      riskTeachersQuery.refetch(),
                      schoolQuery.refetch(),
                    ])
                    setRefreshSuccess(true)
                  } finally {
                    setIsRefreshing(false)
                  }
                }}
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                    Chargement...
                  </>
                ) : refreshSuccess ? (
                  <>
                    <CheckCircle2 className="mr-1 h-4 w-4 text-green-600" />
                    OK
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

        <section ref={alertsRef} className="space-y-3 animate-fade-in">
          <WeekCoverageAlert
            nextWeekHasCoverage={coverageQuery.data?.nextWeekHasCoverage ?? true}
            onNavigateToSchedule={() => navigate("/schedule")}
          />

          {weeklyAbsenceCount > 3 ? (
            <AlertBanner
              type="warning"
              title="Absences profs élevées cette semaine"
              message={`${weeklyAbsenceCount} absences non justifiées ont été relevées sur les 7 derniers jours.`}
              action={{
                label: "Voir les profs",
                onClick: () => navigate("/teachers"),
              }}
            />
          ) : null}
        </section>

        <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4" data-testid="dashboard-statcards">
          <StatCard
            title="Profs actifs"
            value={countsQuery.data?.activeTeachers ?? 0}
            subtitle="Comptes actifs"
            icon={<Users className="h-4 w-4" />}
            trend={{
              value: Number(teacherTrend.toFixed(1)),
              label: "vs mois dernier",
            }}
            variant="default"
          />
          <StatCard
            title="Élèves actifs"
            value={countsQuery.data?.activeStudents ?? 0}
            subtitle="Inscrits actifs"
            icon={<GraduationCap className="h-4 w-4" />}
            variant="default"
          />
          <StatCard
            title="Présence profs aujourd'hui"
            value={`${Math.round(presentRate)}%`}
            subtitle={`${todayQuery.data?.presentCount ?? 0} / ${(todayQuery.data?.courses ?? []).length} pointés`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            variant={presenceVariant}
          />
          <StatCard
            title="Salaires à payer"
            value={formatFcfa(pendingSalaries.totalFcfa)}
            subtitle={`${pendingSalaries.count} fiche(s) en attente`}
            icon={<Wallet className="h-4 w-4" />}
            variant={pendingSalaries.totalFcfa > 0 ? "warning" : "default"}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Présences profs — Aujourd'hui</CardTitle>
            </CardHeader>
            <CardContent>
              <TodayPresenceList courses={todayQuery.data?.courses ?? []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-semibold">Profs à risque</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-sm">
                <Link to={riskTeachersLink} data-testid="dashboard-risk-see-all">Voir tous</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {(riskTeachersQuery.data ?? []).length === 0 ? (
                <EmptyState
                  icon={emptyStateIcons.allGood}
                  title="Aucun profil à risque"
                  message="Aucune absence significative détectée ce mois-ci."
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

        <section>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-semibold">Résumé salaires du mois</CardTitle>
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link to="/salaries">Voir tous les salaires</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {salaryRows.length === 0 ? (
                <EmptyState
                  icon={emptyStateIcons.noTeachers}
                  title="Aucune fiche salaire"
                  message="Aucune ligne de salaire n'est disponible pour ce mois."
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
                            status: row.status,
                            canMarkPaid: row.status === "pending",
                          }}
                          onMarkPaid={() => navigate("/salaries")}
                          onExportPDF={() => navigate("/salaries")}
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
