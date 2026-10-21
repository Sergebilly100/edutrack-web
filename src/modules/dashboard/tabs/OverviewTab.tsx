import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"
import { BookOpenCheck, ChevronRight, GraduationCap, UsersRound } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { formatFcfa, formatFcfaBalance, formatRate } from "@/shared/utils/formatting"
import { formatHours } from "@/modules/dashboard/dashboard.helpers"
import { fetchFinancialSummary } from "@/modules/finance/finance.api"
import {
  calculateAnnualRemainingBalance,
  calculateToDateBalance,
  parseFinancialAmount,
  recoveryProgressValue,
  recoveryRatePercent,
  recoveryTone,
} from "@/modules/finance/financial-dashboard.helpers"
import {
  getDashboardPilotage,
  getDashboardStats,
  type DashboardCourseItem,
  type DashboardHistoryPoint,
} from "@/modules/dashboard/dashboard.api"

type DashboardPriorityAction = {
  id: string
  type: "validations_pending"
  title: string
  message: string
  href: string
  priority: "low" | "medium" | "high"
}

type OverviewTabProps = {
  canViewAttendance: boolean
  canViewTeachers: boolean
  canViewFinance: boolean
  historyData: DashboardHistoryPoint[]
  todayCourses: DashboardCourseItem[]
  todayDate: string
  schoolYearId?: string
  gradingPeriodId?: string
  priorityActions: DashboardPriorityAction[]
}

const QUERY_STALE_TIME = 5 * 60_000

const ATTENDANCE_SERIES = [
  { key: "presentCount", label: "Présents", swatchClass: "bg-[var(--stat-success-fg)]" },
  { key: "lateCount", label: "Retards", swatchClass: "bg-[var(--stat-warning-fg)]" },
  { key: "absentCount", label: "Absents", swatchClass: "bg-[var(--stat-danger-fg)]" },
] as const

const RECOVERY_TONE_TEXT_CLASS = {
  success: "text-green-700",
  warning: "text-amber-800",
  danger: "text-red-700",
} as const

type AttendanceSeriesKey = (typeof ATTENDANCE_SERIES)[number]["key"]

function AttendanceHistoryTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as DashboardHistoryPoint | undefined
  if (!active || !point) return null
  const date = new Date(point.date).toLocaleDateString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long",
  })
  return (
    <div className="w-52 max-w-[calc(100vw-3rem)] rounded-lg border border-border !bg-card p-3 text-xs text-card-foreground opacity-100 shadow-lg ring-1 ring-border">
      <p className="mb-2 break-words font-semibold leading-snug">{date}</p>
      <p className="mb-3 text-muted-foreground">{Math.round(point.attendanceRate)} % de présence</p>
      <div className="space-y-1.5">
        {ATTENDANCE_SERIES.map((series) => (
          <div key={series.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-sm ${series.swatchClass}`} aria-hidden="true" />{series.label}</span>
            <span className="font-semibold tabular-nums">{point[series.key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OverviewTab({
  canViewAttendance,
  canViewTeachers,
  canViewFinance,
  historyData,
  todayCourses,
  todayDate,
  schoolYearId,
  gradingPeriodId,
  priorityActions,
}: OverviewTabProps) {
  const pilotageQuery = useQuery({
    queryKey: ["dashboard", "pilotage", schoolYearId, gradingPeriodId],
    queryFn: () => getDashboardPilotage({ schoolYearId, gradingPeriodId }),
    staleTime: QUERY_STALE_TIME,
  })
  const statsQuery = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
    staleTime: QUERY_STALE_TIME,
    enabled: canViewAttendance,
  })
  const financialQuery = useQuery({
    queryKey: ["finance", "financial-summary", schoolYearId],
    queryFn: () => fetchFinancialSummary(schoolYearId),
    staleTime: QUERY_STALE_TIME,
    enabled: canViewFinance,
  })

  const pilotage = pilotageQuery.data
  const watchItems = priorityActions

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4" data-tour="dashboard-stats">
        <PilotageKpis
          stats={statsQuery.data}
          population={pilotage?.population}
          todayDate={todayDate}
          isLoading={pilotageQuery.isLoading || statsQuery.isLoading}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)] xl:items-start">
        <AttendanceHistoryChart history={historyData} />
        <WatchList items={watchItems} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.38fr)_minmax(22rem,0.82fr)] xl:items-start">
        <AcademicProgress
          levels={pilotage?.academic ?? []}
          confirmedStudents={pilotage?.population.activeStudents}
          isLoading={pilotageQuery.isLoading}
          isError={pilotageQuery.isError}
        />
        <RiskSummary
          risks={pilotage?.risks}
          canViewTeachers={canViewTeachers}
          schoolYearId={schoolYearId}
          gradingPeriodId={gradingPeriodId}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(21rem,0.88fr)] xl:items-start">
        {canViewAttendance ? <TodaySchedule courses={todayCourses} date={todayDate} /> : null}
        {canViewFinance ? (
          <FinancialSnapshot
            summary={financialQuery.data?.school ?? null}
            levels={financialQuery.data?.levels ?? []}
            isLoading={financialQuery.isLoading}
            isError={financialQuery.isError}
          />
        ) : null}
      </section>
    </div>
  )
}

function PilotageKpis({
  stats,
  population,
  todayDate,
  isLoading,
}: {
  stats: Awaited<ReturnType<typeof getDashboardStats>> | undefined
  population: { activeStudents: number; activeTeachers: number; activeClasses: number } | undefined
  todayDate: string
  isLoading: boolean
}) {
  const attendance = stats?.teacherAttendance.globalRate ?? 0
  const teacherPresent = (stats?.teacherAttendance.fullTime.present ?? 0) + (stats?.teacherAttendance.partTime.present ?? 0)
  const teacherExpected = (stats?.teacherAttendance.fullTime.expected ?? 0) + (stats?.teacherAttendance.partTime.expected ?? 0)

  return (
    <>
      <KpiCard label="Présence professeurs" value={formatRate(attendance)} detail={`${teacherPresent}/${teacherExpected} cours pointés`} href={`/teachers?tab=analyse&run=1&from=${todayDate}&to=${todayDate}`} isLoading={isLoading} />
      <KpiCard label="Présence élèves" value={formatRate(stats?.studentAttendance.rate ?? 0)} detail="Aujourd’hui" href={`/students?tab=absences&run=1&from=${todayDate}&to=${todayDate}&min_absences=1`} isLoading={isLoading} />
      <KpiCard label="Élèves confirmés" value={population?.activeStudents ?? 0} detail="Effectif de l’année sélectionnée" href="/students" icon={GraduationCap} isLoading={isLoading} />
      <KpiCard label="Professeurs" value={population?.activeTeachers ?? 0} detail={`${population?.activeClasses ?? 0} classes actives`} href="/teachers" icon={UsersRound} isLoading={isLoading} />
    </>
  )
}

function KpiCard({ label, value, detail, href, icon: Icon, isLoading, secondaryHref, secondaryLabel }: { label: string; value: string | number; detail: string; href?: string; icon?: typeof GraduationCap; isLoading: boolean; secondaryHref?: string; secondaryLabel?: string }) {
  const card = <Card className="min-h-30 rounded-lg shadow-sm transition-colors hover:bg-muted/30"><CardContent className="flex h-full flex-col p-5"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">{label}</p>{Icon ? <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}</div>{isLoading ? <Skeleton className="mt-4 h-10 w-24" /> : <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{value}</p>}<p className="mt-auto pt-3 text-sm text-muted-foreground">{detail}</p>{href && secondaryHref ? <Link to={href} className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Voir {label.toLowerCase()}</Link> : null}{secondaryHref && secondaryLabel ? <Link to={secondaryHref} className="mt-1 inline-flex min-h-10 items-center text-sm font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{secondaryLabel}</Link> : null}</CardContent></Card>
  return href && !secondaryHref ? <Link to={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`${label} : ${value}. ${detail}`}>{card}</Link> : card
}

function AttendanceHistoryChart({ history }: { history: DashboardHistoryPoint[] }) {
  const trend = useMemo(
    () => history.map((item) => ({ ...item, label: new Date(item.date).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" }) })),
    [history],
  )
  const legend = ATTENDANCE_SERIES.filter((series) => trend.some((point) => point[series.key as AttendanceSeriesKey] > 0))

  return (
    <Card className="min-w-0 rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-none p-5 pb-3">
        <div>
          <CardTitle className="text-lg">Présence des professeurs, 7 derniers jours</CardTitle>
          <CardDescription>Par cours planifié, aujourd’hui et les 6 jours précédents.</CardDescription>
        </div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Temps réel</Badge>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {trend.length > 0 ? <>
          <div className="h-64 min-w-0" aria-label="Graphique empilé des présences professeurs sur sept jours">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={1}
              minHeight={1}
              initialDimension={{ width: 1, height: 1 }}
            >
              <BarChart data={trend} margin={{ top: 12, right: 8, left: -18, bottom: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={false} content={AttendanceHistoryTooltip} />
                <Bar dataKey="absentCount" name="Absents" stackId="attendance" fill="var(--stat-danger-fg)" />
                <Bar dataKey="lateCount" name="Retards" stackId="attendance" fill="var(--stat-warning-fg)" />
                <Bar dataKey="presentCount" name="Présents" stackId="attendance" fill="var(--stat-success-fg)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {legend.length > 0 ? <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Légende du graphique">
            {legend.map((item) => <span key={item.key} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${item.swatchClass}`} aria-hidden="true" />{item.label}</span>)}
          </div> : null}
          <p className="sr-only">Utilisez les flèches du clavier sur le graphique pour consulter les valeurs de chaque jour. L’infobulle donne les présents, retards et absents.</p>
        </> : <EmptyState title="Aucune tendance de présence" message="Les données des sept derniers jours apparaîtront ici dès que des cours seront planifiés." classNameRendu="py-8" />}
      </CardContent>
    </Card>
  )
}

const priorityWeight: Record<DashboardPriorityAction["priority"], number> = { high: 0, medium: 1, low: 2 }
const priorityCounterClass: Record<DashboardPriorityAction["priority"], string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-800",
  low: "bg-slate-100 text-slate-700",
}

function priorityCount(message: string): number {
  const value = Number(message.match(/^\s*(\d+)/)?.[1] ?? 0)
  return Number.isFinite(value) ? value : 0
}

function WatchList({ items }: { items: DashboardPriorityAction[] }) {
  const orderedItems = [...items].sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority])
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-none p-5 pb-3">
        <div><CardTitle className="text-lg">Actions prioritaires</CardTitle><CardDescription>Situations qui nécessitent votre décision</CardDescription></div>
        <Badge variant="outline" className="border-border bg-muted text-foreground">{orderedItems.length} sujet{orderedItems.length > 1 ? "s" : ""}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 px-5 pb-5">
        {orderedItems.length > 0 ? orderedItems.map((item) => (
          <Link key={item.id} to={item.href} className="flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <span className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-md px-2 text-lg font-bold tabular-nums ${priorityCounterClass[item.priority]}`}>{priorityCount(item.message)}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="block text-xs text-muted-foreground">Décisions à prendre sur les pointages</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        )) : <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">Aucun sujet prioritaire sur la période sélectionnée.</div>}
      </CardContent>
    </Card>
  )
}

function AcademicProgress({ levels, confirmedStudents, isLoading, isError }: { levels: Awaited<ReturnType<typeof getDashboardPilotage>>["academic"]; confirmedStudents?: number; isLoading: boolean; isError: boolean }) {
  if (isError) return <QueryErrorState message="Impossible de charger la performance académique." />
  const hasIncompleteSubjects = levels.some((level) => level.completedSubjects < level.expectedSubjects)
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-none p-5 pb-3">
        <div><CardTitle className="text-lg">Performance académique de la période</CardTitle><CardDescription>Moyennes générales réelles, regroupées par niveau.</CardDescription>{!isLoading && hasIncompleteSubjects ? <Badge variant="outline" className="mt-2 border-amber-200 bg-amber-50 text-amber-800">Provisoire : moyennes non clôturées</Badge> : null}</div>
        <Button asChild type="button" variant="ghost" size="sm" className="min-h-10 text-blue-700"><Link to="/academic/evaluations">Détails</Link></Button>
      </CardHeader>
      <CardContent className="overflow-x-auto px-5 pb-5">
        {!isLoading && confirmedStudents === 0 ? <EmptyState title="Aucun élève confirmé" message="Les dossiers en attente ne font pas partie de l’effectif scolaire de cette année." classNameRendu="py-5" /> : null}
        {isLoading ? <Skeleton className="h-56 w-full" /> : levels.length > 0 ? (
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="pb-3 font-medium">Niveau</th><th className="pb-3 font-medium">Moyenne générale</th><th className="pb-3 text-right font-medium">Élèves notés</th><th className="pb-3 text-right font-medium">Notes saisies</th><th className="pb-3 text-right font-medium">Notes ≥ 10/20</th></tr></thead>
            <tbody>{levels.map((level) => {
              const hasAverage = level.studentsWithAverage > 0
              const averageTone = (level.averageScore ?? 0) >= 10 ? "text-green-700" : (level.averageScore ?? 0) >= 8 ? "text-amber-800" : "text-red-700"
              const gradesAtLeastTenRate = level.gradeCount > 0 ? Math.round((level.gradesAtLeastTen / level.gradeCount) * 100) : 0
              return <tr key={level.levelId} className="border-b last:border-0"><td className="py-3 font-medium">{level.levelName}<span className="ml-2 text-xs font-normal text-muted-foreground">{level.classCount} classe{level.classCount > 1 ? "s" : ""} · {level.completedSubjects}/{level.expectedSubjects} matières clôturées</span></td><td className={`py-3 font-semibold ${hasAverage ? averageTone : "text-muted-foreground"}`}>{hasAverage ? `${level.averageScore?.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/20` : "En attente"}</td><td className="py-3 text-right font-medium">{level.studentsWithAverage}</td><td className="py-3 text-right font-medium">{level.gradeCount}</td><td className="py-3 text-right font-medium text-green-700">{level.gradesAtLeastTen} <span className="text-xs font-normal text-muted-foreground">({gradesAtLeastTenRate} %)</span></td></tr>
            })}</tbody>
          </table>
        ) : confirmedStudents !== 0 ? <EmptyState icon={BookOpenCheck} title="Aucun niveau à suivre" message="La performance apparaîtra dès que les moyennes de période seront calculées." /> : null}
      </CardContent>
    </Card>
  )
}

function studentRisksHref(schoolYearId?: string, gradingPeriodId?: string): string {
  const params = new URLSearchParams({ tab: "students" })
  if (schoolYearId) params.set("schoolYearId", schoolYearId)
  if (gradingPeriodId) params.set("gradingPeriodId", gradingPeriodId)
  return `/dashboard/risks?${params.toString()}`
}

function RiskSummary({ risks, canViewTeachers, schoolYearId, gradingPeriodId }: {
  risks: Awaited<ReturnType<typeof getDashboardPilotage>>["risks"] | undefined
  canViewTeachers: boolean
  schoolYearId?: string
  gradingPeriodId?: string
}) {
  const studentTotal = (risks?.studentAbsences ?? 0) + (risks?.studentGrades ?? 0) + (risks?.studentPayments ?? 0)
  const studentHref = studentRisksHref(schoolYearId, gradingPeriodId)
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-none p-5 pb-3">
        <div>
          <CardTitle className="text-lg">
            Risques élèves et professeurs
          </CardTitle>
          <CardDescription>
            Signaux calculés selon les règles de l’établissement
          </CardDescription>
        </div>
        <Button
          asChild
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10 text-blue-700"
        >
          <Link to={studentHref}>Voir plus</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <RiskGroup
          title="Élèves"
          total={studentTotal}
          rows={[
            {
              label: "Absentéisme à surveiller",
              value: risks?.studentAbsences ?? 0,
              href: studentHref,
            },
            {
              label: "Baisse de moyenne",
              value: risks?.studentGrades ?? 0,
              href: studentHref,
            },
            {
              label: "Paiements en retard",
              value: risks?.studentPayments ?? 0,
              href: studentHref,
            },
          ]}
        />
        {canViewTeachers ? (
          <RiskGroup
            title="Professeurs"
            total={risks?.teachersAtRisk ?? risks?.teacherAbsences ?? 0}
            rows={[
              {
                label: "Absences répétées",
                value: risks?.teacherAbsences ?? 0,
                href: "/dashboard/risks?tab=teachers",
              },
              {
                label: "Retards répétés",
                value: risks?.teacherLateness ?? 0,
                href: "/dashboard/risks?tab=teachers",
              },
            ]}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function RiskGroup({ title, total, rows }: { title: string; total: number; rows: Array<{ label: string; value: number; href: string }> }) {
  return <div><div className="flex items-center justify-between gap-3 pb-2"><div><p className="font-medium">{title}</p>{title === "Élèves" ? <p className="mt-1 text-xs text-muted-foreground">Un élève peut cumuler plusieurs signaux.</p> : null}</div><Badge variant="outline">{title === "Élèves" ? `${total} signaux de risque` : `${total} à risque`}</Badge></div>{rows.map((row) => <Link key={row.label} to={row.href} className="flex min-h-12 items-center gap-2 border-b px-1 text-sm last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Badge variant="outline" className={row.value > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-border bg-muted text-foreground"}>{row.value}</Badge><span className="flex-1">{row.label}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>)}</div>
}

function TodaySchedule({ courses, date }: { courses: DashboardCourseItem[]; date: string }) {
  const [showAll, setShowAll] = useState(false)
  const sortedCourses = useMemo(() => {
    const rank = (course: DashboardCourseItem) => course.status === "absent" ? 0 : course.status === "present" || course.status === "late" || course.status === "excused" ? 2 : 1
    return [...courses].sort((a, b) => rank(a) - rank(b) || a.startTime.localeCompare(b.startTime))
  }, [courses])
  const visibleCourses = showAll ? sortedCourses : sortedCourses.slice(0, 6)
  const status = (course: DashboardCourseItem) => {
    if (course.status === "present" || course.status === "late" || course.status === "excused") return { label: course.status === "late" ? "Retard" : "Présent", className: "border-green-200 bg-green-50 text-green-700" }
    if (course.status === "absent") return { label: "Absent", className: "border-red-200 bg-red-50 text-red-700" }
    return { label: "À pointer", className: "border-amber-200 bg-amber-50 text-amber-800" }
  }
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-none p-5 pb-3">
        <div>
          <CardTitle className="text-lg">Présences professeurs aujourd’hui</CardTitle>
          <CardDescription>
            {new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </CardDescription>
        </div>
        <div>
          {sortedCourses.length > 6 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-12 text-blue-700"
              aria-expanded={showAll}
              onClick={() => setShowAll((current) => !current)}
            >
              {showAll ? "Afficher moins" : "Afficher tout"}
            </Button>
          ) : null}
          <Button asChild type="button" variant="ghost" size="sm" className="min-h-10 text-blue-700">
            <Link to={`/teachers?tab=analyse&run=1&from=${date}&to=${date}`}>Analyser</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {visibleCourses.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Heure</TableHead>
                  <TableHead>Professeur</TableHead>
                  <TableHead>Matière</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCourses.map((course) => {
                  const courseStatus = status(course)
                  return (
                    <TableRow key={course.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {formatHours(course.startTime)} – {formatHours(course.endTime)}
                      </TableCell>
                      <TableCell>{course.teacherName}</TableCell>
                      <TableCell>{course.subject}</TableCell>
                      <TableCell>{course.className}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={courseStatus.className}>
                          {courseStatus.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={UsersRound}
            title="Aucun créneau aujourd’hui"
            message="Les présences apparaîtront dès qu’un cours est planifié."
          />
        )}
      </CardContent>
    </Card>
  )
}

function FinancialSnapshot({ summary, levels, isLoading, isError }: { summary: Awaited<ReturnType<typeof fetchFinancialSummary>>["school"]; levels: Awaited<ReturnType<typeof fetchFinancialSummary>>["levels"]; isLoading: boolean; isError: boolean }) {
  const expectedToDate = parseFinancialAmount(summary?.total_expected_to_date)
  const collected = parseFinancialAmount(summary?.total_paid)
  const annualTotalDue = parseFinancialAmount(summary?.annual_total_due)
  const overdueToDate = expectedToDate !== null && collected !== null
    ? calculateToDateBalance(expectedToDate, collected)
    : null
  const annualRemaining = annualTotalDue !== null && collected !== null
    ? calculateAnnualRemainingBalance(annualTotalDue, collected)
    : null
  const dateRate = expectedToDate !== null && collected !== null
    ? recoveryRatePercent(expectedToDate, collected)
    : null

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-5 pb-3 border-none">
        <div>
          <CardTitle className="text-lg">Suivi financier</CardTitle>
          <CardDescription>Les mêmes indicateurs que la vue financière.</CardDescription>
        </div>
        <Button asChild type="button" variant="ghost" size="sm" className="min-h-12 text-primary">
          <Link to="/finance/dashboard">Voir tout</Link>
        </Button>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {isLoading ? <Skeleton className="h-56 w-full" /> : null}
        {isError ? <QueryErrorState message="Impossible de charger le suivi financier." /> : null}
        {!isLoading && !isError ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 divide-y rounded-lg border bg-muted/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Metric label="Recouvrement à date" value={dateRate === null ? "Indisponible" : formatRate(dateRate)} />
              <Metric label="Impayé à date" value={overdueToDate === null ? "Indisponible" : formatFcfaBalance(overdueToDate)} />
              <Metric label="Solde annuel restant" value={annualRemaining === null ? "Indisponible" : formatFcfaBalance(annualRemaining)} />
            </div>
            {annualRemaining === null ? (
              <p role="status" className="text-xs text-muted-foreground">
                Le solde annuel ne peut pas être calculé : total annuel ou montant encaissé indisponible.
              </p>
            ) : null}
            {levels.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Niveau</TableHead>
                      <TableHead>Taux à date</TableHead>
                      <TableHead className="text-right">Impayés à date</TableHead>
                      <TableHead className="text-right">Élèves en retard</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levels.slice(0, 4).map((level) => {
                      const levelExpected = parseFinancialAmount(level.total_expected_to_date)
                      const levelCollected = parseFinancialAmount(level.total_paid)
                      const rate = levelExpected !== null && levelCollected !== null
                        ? recoveryRatePercent(levelExpected, levelCollected)
                        : null
                      const levelOverdue = levelExpected !== null && levelCollected !== null
                        ? calculateToDateBalance(levelExpected, levelCollected)
                        : null
                      const overdueClassName = rate === null
                        ? "text-muted-foreground"
                        : RECOVERY_TONE_TEXT_CLASS[recoveryTone(rate)]
                      return (
                        <TableRow key={level.level_id}>
                          <TableCell className="font-medium">{level.level_name}</TableCell>
                          <TableCell className="min-w-40">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={rate === null ? 0 : recoveryProgressValue(rate)}
                                aria-label={rate === null
                                  ? `Recouvrement à date ${level.level_name}, données indisponibles`
                                  : `Recouvrement à date ${level.level_name}, ${rate} %`}
                                className="h-2 [&>div]:bg-primary"
                              />
                              <span className="whitespace-nowrap text-xs font-medium tabular-nums">
                                {rate === null ? "Indisponible" : `${rate} % à date`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-medium tabular-nums ${overdueClassName}`}>
                            {levelOverdue === null ? "Indisponible" : formatFcfaBalance(levelOverdue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={level.students_late_count > 0
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-green-200 bg-green-50 text-green-700"}
                            >
                              {level.students_late_count}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun niveau avec des données financières calculées.</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-base font-semibold tabular-nums">{value}</p></div>
}
