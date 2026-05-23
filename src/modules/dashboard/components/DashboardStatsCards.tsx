import { useQuery } from "@tanstack/react-query"
import { UserCheck, Users, Wallet, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getDashboardStats } from "../dashboard.api"
import { formatFcfa, formatRate } from "@/shared/utils/formatting"
import { cn } from "@/lib/utils"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"

const QUERY_STALE_TIME = 5 * 60 * 1000 // 5 minutes

function getAttendanceColor(rate: number): string {
  if (rate >= 85) return "text-green-600"
  if (rate >= 60) return "text-amber-600"
  return "text-red-600"
}

function getAttendanceBgColor(rate: number): string {
  if (rate >= 85) return "bg-green-50"
  if (rate >= 60) return "bg-amber-50"
  return "bg-red-50"
}

function StatCardSkeleton() {
  return (
    <Card className="border border-gray-100 rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </CardContent>
    </Card>
  )
}

export function DashboardStatsCards() {
  const studentLabels = useStudentLabels()
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
    staleTime: QUERY_STALE_TIME,
    refetchOnWindowFocus: true,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border border-gray-100 rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Données non disponibles
              </CardTitle>
              <p className="text-2xl font-bold text-gray-900">—</p>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  const teacherRate = stats.teacherAttendance.globalRate
  const studentRate = stats.studentAttendance.rate
  const collectionRate = stats.subscriptions.collectionRate
  const showSubscriptionRevenue = stats.subscriptions.isEnabled
  const gridClassName = showSubscriptionRevenue
    ? "grid grid-cols-2 gap-4 lg:grid-cols-4"
    : "grid grid-cols-1 gap-4 sm:grid-cols-3"

  return (
    <div className={gridClassName}>
      {/* CARD 1: Taux de présence professeurs */}
      <Card className="bg-white border border-gray-300/80 rounded-2xl p-5 shadow-sm dark:border-sky-900/50 dark:bg-slate-950/30">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Présence professeurs</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className={cn("text-2xl font-bold", getAttendanceColor(teacherRate))}>
                    {formatRate(teacherRate)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1 text-xs">
                    <p>
                      Calcul : {stats.teacherAttendance.partTime.present + stats.teacherAttendance.fullTime.present} présents /{" "}
                      {stats.teacherAttendance.partTime.expected + stats.teacherAttendance.fullTime.expected} cours prévus
                    </p>
                    <p className="text-muted-foreground">
                      Les retards comptent comme une présence.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", getAttendanceBgColor(teacherRate))}>
            <UserCheck className={cn("h-5 w-5", getAttendanceColor(teacherRate))} />
          </div>
        </div>
        <div className="space-y-1 text-sm text-gray-500">
          <div>
            Vacataires : {formatRate(stats.teacherAttendance.partTime.rate)} (
            {stats.teacherAttendance.partTime.present}/{stats.teacherAttendance.partTime.expected})
          </div>
          <div>
            Permanents : {formatRate(stats.teacherAttendance.fullTime.rate)} (
            {stats.teacherAttendance.fullTime.present}/{stats.teacherAttendance.fullTime.expected})
          </div>
        </div>
      </Card>

      {/* CARD 2: Taux de présence élèves */}
      <Card className="bg-white border border-gray-300/80 rounded-2xl p-5 shadow-sm dark:border-sky-900/50 dark:bg-slate-950/30">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">{`Présence ${studentLabels.pluralLower}`}</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className={cn("text-2xl font-bold", getAttendanceColor(studentRate))}>
                    {formatRate(studentRate)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    Calcul : {stats.studentAttendance.present} présents / {stats.studentAttendance.total} total
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", getAttendanceBgColor(studentRate))}>
            <Users className={cn("h-5 w-5", getAttendanceColor(studentRate))} />
          </div>
        </div>
        <div className="space-y-1 text-sm text-gray-500">
          <div>Présences : {stats.studentAttendance.present}</div>
          <div>Absences : {stats.studentAttendance.absent}</div>
          <div>Pointages restants : {stats.studentAttendance.notMarked}</div>
        </div>
      </Card>

      {/* CARD 3: Salaire à payer ce mois / Économie actuelle */}
      <Card className="bg-white border border-gray-300/80 rounded-2xl p-5 shadow-sm dark:border-sky-900/50 dark:bg-slate-950/30">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Salaire à payer ce mois</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatFcfa(stats.salaries.remainingToPay)}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-blue-600" />
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 px-3 py-2 mt-3 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40">
          <p className="text-xs font-medium text-amber-900 mb-1 dark:text-amber-100">
            Du 1er au {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          </p>
          <div className="space-y-0.5 text-xs text-amber-800 dark:text-amber-100">
            <div>Déjà payé : {formatFcfa(stats.salaries.totalPaid)}</div>
            <div>
              <p>
                Heures prévues : {stats.salaries.economy.plannedHours.toFixed(1)} h 
              </p>
              <p>
                Heures effectuées : {stats.salaries.economy.completedHours.toFixed(1)} h 
              </p>
            </div>
            <div className="font-semibold">
              Économie : {formatFcfa(stats.salaries.economy.savedAmount)}
            </div>
          </div>
        </div>
      </Card>

      {showSubscriptionRevenue ? (
        <Card className="bg-white border border-gray-300/80 rounded-2xl p-5 shadow-sm dark:border-sky-900/50 dark:bg-slate-950/30">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">abonnements encaissé</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatFcfa(stats.subscriptions.collectedAmount)}
              </p>
            </div>
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", getAttendanceBgColor(collectionRate))}>
              <TrendingUp className={cn("h-5 w-5", getAttendanceColor(collectionRate))} />
            </div>
          </div>
          <div className="space-y-1 text-sm text-gray-500">
            <div>Abonnés actifs ce mois : {stats.subscriptions.activeSubscribers} parents</div>
            <div>
              Taux de collecte : {formatRate(collectionRate)}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
