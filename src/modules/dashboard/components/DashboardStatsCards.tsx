import { useQuery } from "@tanstack/react-query"
import { TrendingUp, UserCheck, Users, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { formatFcfa, formatRate } from "@/shared/utils/formatting"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { attendanceTone } from "@/shared/utils/status-tone"
import { getDashboardStats } from "../dashboard.api"

const QUERY_STALE_TIME = 5 * 60 * 1000

type DashboardStatsCardsProps = { showTeacherCard?: boolean; showStudentCard?: boolean; showSalaryCard?: boolean; showSubscriptionCard?: boolean }

export function DashboardStatsCards({ showTeacherCard = true, showStudentCard = true, showSalaryCard = true, showSubscriptionCard = true }: DashboardStatsCardsProps = {}) {
  const studentLabels = useStudentLabels()
  const statsQuery = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => getDashboardStats(), staleTime: QUERY_STALE_TIME, refetchOnWindowFocus: true })

  if (!showTeacherCard && !showStudentCard && !showSalaryCard && !showSubscriptionCard) return null
  if (statsQuery.isLoading) return <DashboardStatsSkeleton />
  if (statsQuery.isError || !statsQuery.data) return <QueryErrorState message="Impossible de charger les indicateurs de l’école." onRetry={() => void statsQuery.refetch()} isRetrying={statsQuery.isFetching} />

  const { teacherAttendance, studentAttendance, salaries, subscriptions } = statsQuery.data
  const showSubscriptions = subscriptions.isEnabled && showSubscriptionCard
  const hasAttendance = showTeacherCard || showStudentCard
  const hasOperations = showSalaryCard || showSubscriptions

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
    {hasAttendance ? <Card className="rounded-lg border-0 bg-blue-700 text-blue-50 shadow-sm" data-tour="dashboard-stats"><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-medium text-blue-100">Rythme de l’école aujourd’hui</p><p className="mt-2 text-3xl font-semibold tracking-tight">Suivi des présences</p><p className="mt-2 max-w-lg text-sm text-blue-100">Les indicateurs montrent les cours et appels attendus à la date du jour.</p></div><Badge variant="outline" className="w-fit border-blue-300 bg-blue-800/40 text-blue-50">Temps réel</Badge></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{showTeacherCard ? <AttendanceMetric icon={UserCheck} label="Présence professeurs" value={formatRate(teacherAttendance.globalRate)} detail={`${teacherAttendance.partTime.present + teacherAttendance.fullTime.present}/${teacherAttendance.partTime.expected + teacherAttendance.fullTime.expected} cours pointés`} /> : null}{showStudentCard ? <AttendanceMetric icon={Users} label={`Présence ${studentLabels.pluralLower}`} value={formatRate(studentAttendance.rate)} detail={`${studentAttendance.absent} absence${studentAttendance.absent > 1 ? "s" : ""} · ${studentAttendance.notMarked} appel${studentAttendance.notMarked > 1 ? "s" : ""} restant${studentAttendance.notMarked > 1 ? "s" : ""}`} /> : null}</div></CardContent></Card> : null}

    {hasOperations ? <Card className="rounded-lg shadow-sm"><CardHeader className="pb-3"><CardDescription>Suivi opérationnel</CardDescription><CardTitle className="text-lg">Ce mois</CardTitle></CardHeader><CardContent className="space-y-4">{showSalaryCard ? <OperationMetric icon={Wallet} label="Salaire à payer ce mois" value={formatFcfa(salaries.remainingToPay)} detail={`${formatFcfa(salaries.totalPaid)} déjà versés · ${formatFcfa(salaries.economy.savedAmount)} économisés`} /> : null}{showSalaryCard && showSubscriptions ? <div className="border-t" /> : null}{showSubscriptions ? <OperationMetric icon={TrendingUp} label="abonnements encaissé" value={formatFcfa(subscriptions.collectedAmount)} detail={`${subscriptions.activeSubscribers} parent${subscriptions.activeSubscribers > 1 ? "s" : ""} actif${subscriptions.activeSubscribers > 1 ? "s" : ""} · ${formatRate(subscriptions.collectionRate)} de collecte`} /> : null}</CardContent></Card> : null}
  </div>
}

function AttendanceMetric({ icon: Icon, label, value, detail }: { icon: typeof UserCheck; label: string; value: string; detail: string }) {
  const tone = attendanceTone(Number(value.replace("%", "")))
  const status = tone === "success" ? "Stable" : tone === "warning" ? "À suivre" : "Prioritaire"
  const statusClassName = tone === "success" ? "bg-green-100 text-green-800" : tone === "warning" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800"
  return <div className="rounded-lg bg-blue-800/45 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-blue-100">{label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p></div><Icon className="h-5 w-5 text-blue-100" /></div><p className="mt-3 text-xs text-blue-100">{detail}</p><Badge variant="outline" className={`mt-3 border-0 ${statusClassName}`}>{status}</Badge></div>
}

function OperationMetric({ icon: Icon, label, value, detail }: { icon: typeof Wallet; label: string; value: string; detail: string }) {
  return <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/20"><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></div>
}

function DashboardStatsSkeleton() {
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]"><Skeleton className="h-72 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></div>
}
