import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { BookOpenCheck, ChevronRight, CircleAlert, GraduationCap, UsersRound } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { formatFcfa, formatRate } from "@/shared/utils/formatting"
import { fetchFinancialSummary } from "@/modules/finance/finance.api"
import {
  getDashboardPilotage,
  getDashboardStats,
  type DashboardCourseItem,
  type DashboardHistoryPoint,
} from "@/modules/dashboard/dashboard.api"

type DashboardPriorityAction = {
  id: string
  title: string
  message: string
  href: string
  tone: "warning" | "info" | "success" | "danger"
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
  const watchItems = [
    ...priorityActions,
    { id: "absence", title: "Absentéisme élevé", message: "Élèves concernés par la règle d’absence", href: "/students?tab=absences", tone: "danger" as const, value: pilotage?.risks.studentAbsences ?? 0 },
    { id: "grades", title: "Baisse de moyenne", message: "Élèves signalés entre deux périodes", href: "/students", tone: "warning" as const, value: pilotage?.risks.studentGrades ?? 0 },
    { id: "payments", title: "Paiements en retard", message: "Familles à régulariser", href: "/finance/dashboard", tone: "warning" as const, value: pilotage?.risks.studentPayments ?? 0 },
    { id: "completion", title: "Matières à clôturer", message: "Matières dont les moyennes ne sont pas validées", href: "/academic/completion", tone: "info" as const, value: Math.max(0, (pilotage?.academic ?? []).reduce((total, row) => total + row.expectedSubjects - row.completedSubjects, 0)) },
  ].filter((item) => !("value" in item) || item.value > 0)

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)]">
        <PilotageHero
          stats={statsQuery.data}
          history={historyData}
          population={pilotage?.population}
          isLoading={pilotageQuery.isLoading || statsQuery.isLoading}
        />
        <WatchList items={watchItems} canViewTeachers={canViewTeachers} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.38fr)_minmax(22rem,0.82fr)]">
        <AcademicProgress
          levels={pilotage?.academic ?? []}
          isLoading={pilotageQuery.isLoading}
          isError={pilotageQuery.isError}
        />
        <RiskSummary risks={pilotage?.risks} canViewTeachers={canViewTeachers} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(21rem,0.88fr)]">
        {canViewAttendance ? <TodaySchedule courses={todayCourses} date={todayDate} /> : null}
        {canViewFinance ? (
          <FinancialSnapshot
            summary={financialQuery.data?.school ?? null}
            levels={financialQuery.data?.levels ?? []}
            upcomingInstallments={financialQuery.data?.upcomingInstallments ?? []}
            isLoading={financialQuery.isLoading}
            isError={financialQuery.isError}
          />
        ) : null}
      </section>
    </div>
  )
}

function PilotageHero({
  stats,
  history,
  population,
  isLoading,
}: {
  stats: Awaited<ReturnType<typeof getDashboardStats>> | undefined
  history: DashboardHistoryPoint[]
  population: { activeStudents: number; activeTeachers: number; activeClasses: number } | undefined
  isLoading: boolean
}) {
  const trend = useMemo(
    () => history.map((item) => ({ ...item, label: new Date(item.date).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" }) })),
    [history]
  )
  const attendance = stats?.teacherAttendance.globalRate ?? 0
  const teacherPresent = (stats?.teacherAttendance.fullTime.present ?? 0) + (stats?.teacherAttendance.partTime.present ?? 0)
  const teacherExpected = (stats?.teacherAttendance.fullTime.expected ?? 0) + (stats?.teacherAttendance.partTime.expected ?? 0)

  return (
    <Card className="rounded-lg border-0 bg-blue-700 text-blue-50 shadow-sm" data-tour="dashboard-stats">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-100">Vue de pilotage</p>
            <p className="mt-1 text-xs text-blue-100">Taux de présence, 7 derniers jours</p>
          </div>
          <Badge variant="outline" className="border-blue-300 bg-blue-800/35 text-blue-50">Temps réel</Badge>
        </div>

        {isLoading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <Skeleton className="h-32 bg-blue-600" />
            <Skeleton className="h-32 bg-blue-600" />
          </div>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
            <div className="border-b border-blue-500 pb-5 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5">
              <p className="text-5xl font-semibold tracking-tight tabular-nums">{formatRate(attendance)}</p>
              <p className="mt-2 text-sm text-blue-100">Présence professeurs</p>
              <p className="mt-2 text-xs text-blue-100">Présence élèves : {formatRate(stats?.studentAttendance.rate ?? 0)}</p>
              <p className="mt-4 text-xs text-blue-100">{teacherPresent}/{teacherExpected} cours pointés</p>
            </div>
            <div className="h-36">
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 16, right: 6, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(213 94% 68% / 0.35)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: "hsl(214 100% 93%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(214 100% 93%)", fontSize: 11 }} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => `${Math.round(Number(value))}%`} />
                    <Area type="monotone" dataKey="attendanceRate" stroke="hsl(0 0% 100%)" strokeWidth={2.5} fill="hsl(0 0% 100% / 0.18)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center text-sm text-blue-100">Aucune tendance de présence disponible.</div>}
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 divide-x divide-blue-500 border-t border-blue-500 pt-4">
          <PopulationStat icon={GraduationCap} label="Élèves inscrits" value={population?.activeStudents ?? 0} />
          <PopulationStat icon={UsersRound} label="Professeurs" value={population?.activeTeachers ?? 0} />
          <PopulationStat icon={BookOpenCheck} label="Classes" value={population?.activeClasses ?? 0} />
        </div>
      </CardContent>
    </Card>
  )
}

function PopulationStat({ icon: Icon, label, value }: { icon: typeof GraduationCap; label: string; value: number }) {
  return <div className="min-w-0 px-3 first:pl-0 last:pr-0"><div className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-blue-100" /><p className="truncate text-xl font-semibold tabular-nums">{value}</p></div><p className="mt-1 truncate text-xs text-blue-100">{label}</p></div>
}

function WatchList({ items, canViewTeachers }: { items: Array<DashboardPriorityAction & { value?: number }>; canViewTeachers: boolean }) {
  const toneClass = { danger: "border-red-200 bg-red-50 text-red-700", warning: "border-amber-200 bg-amber-50 text-amber-800", info: "border-blue-200 bg-blue-50 text-blue-800", success: "border-green-200 bg-green-50 text-green-700" }
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div><CardTitle className="text-lg">À surveiller</CardTitle><CardDescription>Actions et situations nécessitant un suivi</CardDescription></div>
        {canViewTeachers ? <Button asChild type="button" variant="ghost" size="sm" className="min-h-10 text-blue-700" data-testid="dashboard-risk-see-all"><Link to="/teachers">Voir tous</Link></Button> : null}
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.length > 0 ? items.slice(0, 4).map((item) => (
          <Link key={item.id} to={item.href} className="flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50">
            <CircleAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.message}</span></span>
            {typeof item.value === "number" ? <Badge variant="outline" className={toneClass[item.tone]}>{item.value}</Badge> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            {typeof item.value === "number" ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
          </Link>
        )) : <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">Aucun signal prioritaire sur la période sélectionnée.</div>}
      </CardContent>
    </Card>
  )
}

function AcademicProgress({ levels, isLoading, isError }: { levels: Awaited<ReturnType<typeof getDashboardPilotage>>["academic"]; isLoading: boolean; isError: boolean }) {
  if (isError) return <QueryErrorState message="Impossible de charger la performance académique." />
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div><CardTitle className="text-lg">Performance académique de la période</CardTitle><CardDescription>Moyennes générales réelles, regroupées par niveau.</CardDescription></div>
        <Button asChild type="button" variant="ghost" size="sm" className="min-h-10 text-blue-700"><Link to="/academic/completion">Détails</Link></Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? <Skeleton className="h-56 w-full" /> : levels.length > 0 ? (
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="pb-3 font-medium">Niveau</th><th className="pb-3 font-medium">Moyenne</th><th className="pb-3 text-right font-medium">Élèves notés</th><th className="pb-3 text-right font-medium">≥ 10/20</th><th className="pb-3 text-right font-medium">8–9,99</th><th className="pb-3 text-right font-medium">&lt; 8/20</th></tr></thead>
            <tbody>{levels.map((level) => {
              const hasAverage = level.studentsWithAverage > 0
              const averageTone = (level.averageScore ?? 0) >= 10 ? "text-green-700" : (level.averageScore ?? 0) >= 8 ? "text-amber-800" : "text-red-700"
              return <tr key={level.levelId} className="border-b last:border-0"><td className="py-3 font-medium">{level.levelName}<span className="ml-2 text-xs font-normal text-muted-foreground">{level.classCount} classe{level.classCount > 1 ? "s" : ""} · {level.completedSubjects}/{level.expectedSubjects} matières clôturées</span></td><td className={`py-3 font-semibold ${hasAverage ? averageTone : "text-muted-foreground"}`}>{hasAverage ? `${level.averageScore?.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/20` : "En attente"}</td><td className="py-3 text-right font-medium">{level.studentsWithAverage}</td><td className="py-3 text-right font-medium text-green-700">{level.performingStudents}</td><td className="py-3 text-right font-medium text-amber-800">{level.attentionStudents}</td><td className="py-3 text-right font-medium text-red-700">{level.criticalStudents}</td></tr>
            })}</tbody>
          </table>
        ) : <EmptyState icon={BookOpenCheck} title="Aucun niveau à suivre" message="La performance apparaîtra dès que les moyennes de période seront calculées." />}
      </CardContent>
    </Card>
  )
}

function RiskSummary({ risks, canViewTeachers }: { risks: Awaited<ReturnType<typeof getDashboardPilotage>>["risks"] | undefined; canViewTeachers: boolean }) {
  const studentTotal = (risks?.studentAbsences ?? 0) + (risks?.studentGrades ?? 0) + (risks?.studentPayments ?? 0)
  return <Card className="rounded-lg shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-lg">Risques élèves et professeurs</CardTitle><CardDescription>Signaux calculés selon les règles de l’établissement</CardDescription></CardHeader><CardContent className="space-y-4"><RiskGroup title="Élèves" total={studentTotal} rows={[{ label: "Absentéisme à surveiller", value: risks?.studentAbsences ?? 0, href: "/students?tab=absences" }, { label: "Baisse de moyenne", value: risks?.studentGrades ?? 0, href: "/students" }, { label: "Paiements en retard", value: risks?.studentPayments ?? 0, href: "/finance/dashboard" }]} />{canViewTeachers ? <RiskGroup title="Professeurs" total={risks?.teacherAbsences ?? 0} rows={[{ label: "Absences répétées", value: risks?.teacherAbsences ?? 0, href: "/teachers?tab=analyse" }]} /> : null}</CardContent></Card>
}

function RiskGroup({ title, total, rows }: { title: string; total: number; rows: Array<{ label: string; value: number; href: string }> }) {
  return <div className="rounded-lg border"><div className="flex items-center justify-between border-b px-3 py-2"><p className="font-medium">{title}</p><Badge variant="outline">{total} à risque</Badge></div>{rows.map((row) => <Link key={row.label} to={row.href} className="flex min-h-10 items-center gap-2 px-3 text-sm hover:bg-muted/50"><Badge variant="outline" className={row.value > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}>{row.value}</Badge><span className="flex-1">{row.label}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>)}</div>
}

function TodaySchedule({ courses, date }: { courses: DashboardCourseItem[]; date: string }) {
  const rows = useMemo(() => [...courses].sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 6), [courses])
  const status = (course: DashboardCourseItem) => {
    if (course.status === "present" || course.status === "late" || course.status === "excused") return { label: course.status === "late" ? "Retard" : "Présent", className: "border-green-200 bg-green-50 text-green-700" }
    if (course.status === "absent") return { label: "Absent", className: "border-red-200 bg-red-50 text-red-700" }
    return { label: "À pointer", className: "border-amber-200 bg-amber-50 text-amber-800" }
  }
  return <Card className="rounded-lg shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-3 pb-3"><div><CardTitle className="text-lg">Présences aujourd’hui</CardTitle><CardDescription>{new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}</CardDescription></div><Button asChild type="button" variant="ghost" size="sm" className="min-h-10 text-blue-700"><Link to="/attendance">Voir tout</Link></Button></CardHeader><CardContent>{rows.length > 0 ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Heure</TableHead><TableHead>Professeur</TableHead><TableHead>Matière</TableHead><TableHead>Classe</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{rows.map((course) => { const courseStatus = status(course); return <TableRow key={course.id}><TableCell className="whitespace-nowrap font-medium">{course.startTime} – {course.endTime}</TableCell><TableCell>{course.teacherName}</TableCell><TableCell>{course.subject}</TableCell><TableCell>{course.className}</TableCell><TableCell><Badge variant="outline" className={courseStatus.className}>{courseStatus.label}</Badge></TableCell></TableRow> })}</TableBody></Table></div> : <EmptyState icon={UsersRound} title="Aucun créneau aujourd’hui" message="Les présences apparaîtront dès qu’un cours est planifié." />}</CardContent></Card>
}

function FinancialSnapshot({ summary, levels, upcomingInstallments, isLoading, isError }: { summary: Awaited<ReturnType<typeof fetchFinancialSummary>>["school"]; levels: Awaited<ReturnType<typeof fetchFinancialSummary>>["levels"]; upcomingInstallments: Awaited<ReturnType<typeof fetchFinancialSummary>>["upcomingInstallments"]; isLoading: boolean; isError: boolean }) {
  const remaining = Math.max(0, Number(summary?.total_expected_to_date ?? 0) - Number(summary?.total_paid ?? 0))
  const upcomingAmount = upcomingInstallments.reduce((total, row) => total + Number(row.expected_amount), 0)
  return <Card className="rounded-lg shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-3 pb-3"><div><CardTitle className="text-lg">Suivi financier</CardTitle><CardDescription>Situation à date et prochaines échéances</CardDescription></div><Button asChild type="button" variant="ghost" size="sm" className="min-h-10 text-blue-700"><Link to="/finance/dashboard">Voir tout</Link></Button></CardHeader><CardContent>{isLoading ? <Skeleton className="h-56 w-full" /> : isError ? <QueryErrorState message="Impossible de charger le suivi financier." /> : <div className="space-y-4"><div className="grid grid-cols-3 divide-x rounded-lg border bg-muted/20"><Metric label="Taux de recouvrement" value={formatRate(Number(summary?.recovery_rate ?? 0))} /><Metric label="Montant restant dû" value={formatFcfa(remaining)} /><Metric label="Échéances à venir" value={formatFcfa(upcomingAmount)} /></div>{levels.length > 0 ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Niveau</TableHead><TableHead>Taux de recouvrement</TableHead><TableHead className="text-right">Montant restant dû</TableHead><TableHead className="text-right">Élèves en retard</TableHead></TableRow></TableHeader><TableBody>{levels.slice(0, 4).map((level) => { const expected = Number(level.total_expected_to_date); const paid = Number(level.total_paid); const rate = expected > 0 ? Math.round((paid / expected) * 100) : 100; return <TableRow key={level.level_id}><TableCell className="font-medium">{level.level_name}</TableCell><TableCell className="min-w-40"><div className="flex items-center gap-2"><Progress value={rate} className="h-2" /><span className="text-xs font-medium tabular-nums">{rate}%</span></div></TableCell><TableCell className="text-right font-medium tabular-nums">{formatFcfa(Math.max(0, expected - paid))}</TableCell><TableCell className="text-right"><Badge variant="outline" className={level.students_late_count > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-green-200 bg-green-50 text-green-700"}>{level.students_late_count}</Badge></TableCell></TableRow> })}</TableBody></Table></div> : <p className="text-sm text-muted-foreground">Aucun niveau avec des données financières calculées.</p>}</div>}</CardContent></Card>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-base font-semibold tabular-nums">{value}</p></div>
}
