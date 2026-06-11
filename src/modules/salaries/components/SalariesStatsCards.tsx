import { useQuery } from "@tanstack/react-query"
import { Receipt, CheckCircle, PiggyBank, BarChart2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getSalariesStats } from "../salaries.api"
import { formatFcfa, formatRate } from "@/shared/utils/formatting"
import { formatDecimalHours } from "../../../../../edutrack-api/src/shared/utils/time"
import { cn } from "@/lib/utils"

const QUERY_STALE_TIME = 5 * 60 * 1000 // 5 minutes

type SalariesStatsCardsProps = {
  month?: string
  toPayVacataire?: number
  toPayPermanent?: number
}

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
    <Card className="border border-gray-100 rounded-2xl shadow-sm dark:border-sky-900/50 dark:bg-slate-950/30">
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
    </Card>
  )
}

export function SalariesStatsCards({ month, toPayVacataire, toPayPermanent }: SalariesStatsCardsProps) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["salaries-stats", month ?? "current"],
    queryFn: () => getSalariesStats(month),
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
          <Card key={i} className="border border-gray-100 rounded-2xl shadow-sm p-5">
            <p className="text-sm font-medium text-gray-500 mb-1">Données non disponibles</p>
            <p className="text-2xl font-bold text-gray-900">-</p>
          </Card>
        ))}
      </div>
    )
  }

  const attendanceRate = stats.teacherAttendance.globalRate
  const paymentProgress = stats.totalPayroll > 0 ? Math.min(100, (stats.totalPaid / stats.totalPayroll) * 100) : 0

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {/* CARD 1: Total à payer ce mois */}
      <Card className="bg-white border border-gray-300/80 rounded-2xl p-5 shadow-sm dark:border-sky-900/50 dark:bg-slate-950/30">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Total à payer ce mois</p>
            <p className="text-2xl font-bold text-gray-900  dark:text-white">{formatFcfa(stats.totalToPay)}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-blue-600" />
          </div>
        </div>
        <div className="space-y-0.5 text-sm text-gray-500">
          <p>Masse salariale du mois : {formatFcfa(stats.totalPayroll)}</p>
          {(toPayVacataire !== undefined && toPayVacataire > 0) || (toPayPermanent !== undefined && toPayPermanent > 0) ? (
            <div className="pt-1 space-y-0.5 border-t border-gray-100 mt-1">
              {toPayVacataire !== undefined && toPayVacataire > 0 && (
                <p>Vacataires : <span className="font-medium text-gray-700">{formatFcfa(toPayVacataire)}</span></p>
              )}
              {toPayPermanent !== undefined && toPayPermanent > 0 && (
                <p>Permanents : <span className="font-medium text-gray-700">{formatFcfa(toPayPermanent)}</span></p>
              )}
            </div>
          ) : null}
        </div>
      </Card>

      {/* CARD 2: Total déjà payé */}
      <Card className="bg-white border border-gray-300/80 rounded-2xl p-5 shadow-sm dark:border-sky-900/50 dark:bg-slate-950/30">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Total déjà payé</p>
            <p className="text-2xl font-bold text-gray-900  dark:text-white">{formatFcfa(stats.totalPaid)}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{formatRate(paymentProgress)} du mois réglé</span>
          </div>
          <Progress value={paymentProgress} className="h-2" />
        </div>
      </Card>

      {/* CARD 3: Économie du mois */}
      <Card className="bg-white border border-gray-300/80 rounded-2xl p-5 shadow-sm dark:border-sky-900/50 dark:bg-slate-950/30">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Économie du mois (vacataire)</p>
            <p className="text-2xl font-bold text-amber-600  dark:text-white">{formatFcfa(stats.economy.savedAmount)}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <PiggyBank className="h-5 w-5 text-amber-600" />
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="space-y-1 text-sm text-gray-500 cursor-help">
                <div>Du 1er à aujourd'hui: {formatDecimalHours(stats.economy.plannedHours)}</div>
                <div>Heures effectuées : {formatDecimalHours(stats.economy.completedHours)}</div>
                <div>Heures manquées : {formatDecimalHours(stats.economy.plannedHours - stats.economy.completedHours)}</div>
                <div className="font-semibold text-amber-900">Économie : {formatFcfa(stats.economy.savedAmount)}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-xs">
                Basé sur les heures non effectuées et non justifiées uniquement.
                Les absences justifiées sont exclues du calcul.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Card>

      {/* CARD 4: Taux de présence professeurs (placée en première ligne sur mobile) */}
      <Card className="bg-white border border-gray-300/80 rounded-2xl p-5 shadow-sm dark:border-sky-900/50 dark:bg-slate-950/30">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Taux de présence profs</p>
            <p className={cn("text-2xl font-bold dark:text-white", getAttendanceColor(attendanceRate))}>
              {formatRate(attendanceRate)}
            </p>
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", getAttendanceBgColor(attendanceRate))}>
            <BarChart2 className={cn("h-5 w-5", getAttendanceColor(attendanceRate))} />
          </div>
        </div>
        <div className="space-y-1 text-sm text-gray-500">
          <div>
            Vacataires : {formatRate(stats.teacherAttendance.partTime.rate)} (
            {formatDecimalHours(stats.teacherAttendance.partTime.present)}/{formatDecimalHours(stats.teacherAttendance.partTime.expected)})
          </div>
          <div>
            Permanents : {formatRate(stats.teacherAttendance.fullTime.rate)} (
            {formatDecimalHours(stats.teacherAttendance.fullTime.present)}/{formatDecimalHours(stats.teacherAttendance.fullTime.expected)})
          </div>
        </div>
      </Card>
    </div>
  )
}
