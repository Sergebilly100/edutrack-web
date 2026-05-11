import { useQuery } from "@tanstack/react-query"
import { Banknote, Building2, Percent, ArrowRightLeft } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getSubscriptionsRevenueStats } from "../subscriptions.api"
import { formatFcfa, formatRate } from "@/shared/utils/formatting"
import { cn } from "@/lib/utils"

const QUERY_STALE_TIME = 5 * 60 * 1000 // 5 minutes

type SubscriptionsStatsCardsProps = {
  month?: string
}

function getCollectionColor(rate: number): string {
  if (rate >= 85) return "text-green-600"
  if (rate >= 60) return "text-amber-600"
  return "text-red-600"
}

function getCollectionBgColor(rate: number): string {
  if (rate >= 85) return "bg-green-50"
  if (rate >= 60) return "bg-amber-50"
  return "bg-red-50"
}

function StatCardSkeleton() {
  return (
    <Card className="border border-gray-100 rounded-2xl shadow-sm">
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

export function SubscriptionsStatsCards({ month }: SubscriptionsStatsCardsProps) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["subscriptions", "revenue", "stats", month ?? "current"],
    queryFn: () => getSubscriptionsRevenueStats(month),
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
            <p className="text-2xl font-bold text-gray-900">—</p>
          </Card>
        ))}
      </div>
    )
  }

  const isOverdue = stats.isReverseOverdue
  const reverseColor = isOverdue ? "text-red-600" : stats.remainingToReverse === 0 ? "text-green-600" : "text-blue-600"
  const reverseBgColor = isOverdue ? "bg-red-50" : stats.remainingToReverse === 0 ? "bg-green-50" : "bg-blue-50"

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* CARD 1: Montant encaissé ce mois */}
      <Card className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Montant encaissé ce mois</p>
            <p className="text-2xl font-bold text-gray-900">{formatFcfa(stats.collectedAmount)}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Banknote className="h-5 w-5 text-green-600" />
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {stats.activeSubscribers} abonnements actifs • {stats.newSubscribers} nouveau(x)
        </p>
      </Card>

      {/* CARD 2: Gain de l'école ce mois */}
      <Card className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Gain de l'école ce mois</p>
            <p className="text-2xl font-bold text-gray-900">{formatFcfa(stats.schoolGain)}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
        </div>
        <p className="text-sm text-gray-500">Net après commission EduTrack ({formatRate(stats.commissionRate)})</p>
      </Card>

      {/* CARD 3: Commission EduTrack */}
      <Card className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Commission EduTrack</p>
            <p className="text-2xl font-bold text-gray-900">{formatFcfa(stats.edutrackCommission)}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <Percent className="h-5 w-5 text-purple-600" />
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {formatRate(stats.commissionRate)} × {formatFcfa(stats.collectedAmount)}
        </p>
      </Card>

      {/* CARD 4: Reste à reverser à EduTrack */}
      <Card className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Reste à reverser à EduTrack</p>
            <p className={cn("text-2xl font-bold", reverseColor)}>{formatFcfa(stats.remainingToReverse)}</p>
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", reverseBgColor)}>
            <ArrowRightLeft className={cn("h-5 w-5", reverseColor)} />
            {isOverdue && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full animate-pulse" />
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {stats.nextReverseDate
            ? `Prochain reversement : ${new Date(stats.nextReverseDate).toLocaleDateString("fr-FR")}`
            : stats.remainingToReverse === 0
            ? `Commission réglée (${formatFcfa(stats.commissionPaid)} payé)`
            : `${formatFcfa(stats.commissionPaid)} déjà reversé`}
        </p>
      </Card>
    </div>
  )
}
