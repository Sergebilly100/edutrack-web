import { useQuery } from "@tanstack/react-query"
import { UserCheck, Users, Wallet, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getDashboardStats } from "../dashboard.api"
import { formatFcfa, formatRate } from "@/shared/utils/formatting"
import { formatDecimalHours } from "@/shared/utils/time"
import { cn } from "@/lib/utils"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { attendanceTone, statusToneIconBg, statusToneText } from "@/shared/utils/status-tone"

const QUERY_STALE_TIME = 5 * 60 * 1000 // 5 minutes

const getAttendanceColor = (rate: number): string => statusToneText[attendanceTone(rate)]
const getAttendanceBgColor = (rate: number): string => statusToneIconBg[attendanceTone(rate)]

/**
 * Classe de grille responsive cohérente quel que soit le nombre de cartes
 * visibles (1 à 4). Utilisée pour le skeleton, l'état d'erreur ET l'état chargé
 * afin d'éviter tout décalage de disposition entre ces états.
 *
 * Le nombre de colonnes au plus large breakpoint suit EXACTEMENT le nombre de
 * cartes visibles : chaque carte vaut 1fr et remplit toute la ligne - pas de
 * colonne vide quand une carte est masquée (ex. staff sans droit salaire).
 * - 1 carte  : 1 col à toutes tailles
 * - 2 cartes : 1 col (mobile) → 2 col (≥sm)
 * - 3 cartes : 1 col (mobile) → 3 col (≥sm)
 * - 4 cartes : 2 col (mobile) → 4 col (≥lg)
 */
function statsGridClassName(count: number): string {
  switch (count) {
    case 1:
      return "grid grid-cols-1 gap-4"
    case 2:
      return "grid grid-cols-1 gap-4 sm:grid-cols-2"
    case 3:
      return "grid grid-cols-1 gap-4 sm:grid-cols-3"
    default:
      return "grid grid-cols-2 gap-4 lg:grid-cols-4"
  }
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

type DashboardStatsCardsProps = {
  /** Carte « Présence professeurs » (défaut visible - directeur). */
  showTeacherCard?: boolean
  /** Carte « Présence élèves » (défaut visible - directeur). */
  showStudentCard?: boolean
  /** Carte « Salaire à payer ce mois » (défaut visible - directeur). */
  showSalaryCard?: boolean
  /**
   * Carte « Revenus abonnements » (défaut visible - directeur).
   * Dépend AUSSI de stats.subscriptions.isEnabled. Le droit côté staff est
   * `subscriptions.view` / `subscriptions.revenue`, distinct du droit salaire.
   */
  showSubscriptionCard?: boolean
}

export function DashboardStatsCards({
  showTeacherCard = true,
  showStudentCard = true,
  showSalaryCard = true,
  showSubscriptionCard = true,
}: DashboardStatsCardsProps = {}) {
  const studentLabels = useStudentLabels()
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
    staleTime: QUERY_STALE_TIME,
    refetchOnWindowFocus: true,
  })

  // Nombre de cartes potentiellement visibles avant chargement des données.
  // La carte « revenus abonnements » dépend de stats.subscriptions.isEnabled,
  // on ne la compte donc pas ici (skeleton/erreur).
  const baseVisibleCount =
    Number(showTeacherCard) + Number(showStudentCard) + Number(showSalaryCard)
  const placeholderGridClassName = statsGridClassName(baseVisibleCount)

  if (baseVisibleCount === 0) {
    return null
  }

  if (isLoading) {
    return (
      <div className={placeholderGridClassName}>
        {Array.from({ length: baseVisibleCount }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className={placeholderGridClassName}>
        {Array.from({ length: baseVisibleCount }, (_, index) => index + 1).map((i) => (
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
  // La carte revenus suit la fonctionnalité abonnements (isEnabled) ET le droit
  // d'accès abonnements du staff (subscriptions.view / .revenue), pas le salaire.
  const showSubscriptionRevenue = stats.subscriptions.isEnabled && showSubscriptionCard
  const visibleCount =
    Number(showTeacherCard) +
    Number(showStudentCard) +
    Number(showSalaryCard) +
    Number(showSubscriptionRevenue)
  const gridClassName = statsGridClassName(visibleCount)

  if (visibleCount === 0) {
    return null
  }

  return (
    <div className={gridClassName}  data-tour="dashboard-stats">
      {/* CARD 1: Taux de présence professeurs */}
      {showTeacherCard ? (
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
      ) : null}

      {/* CARD 2: Taux de présence élèves */}
      {showStudentCard ? (
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
      ) : null}

      {/* CARD 3: Salaire à payer ce mois / Économie actuelle */}
      {showSalaryCard ? (
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

        <div className="rounded-lg px-3 py-2 mt-3 border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40">
          <p className="text-xs font-medium text-amber-900 mb-1 dark:text-amber-100">
            Du 1er au {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          </p>
          <div className="space-y-0.5 text-xs text-amber-800 dark:text-amber-100">
            <div>Déjà payé : {formatFcfa(stats.salaries.totalPaid)}</div>
            <div>
              <p>
                Heures prévues : {formatDecimalHours(stats.salaries.economy.plannedHours)}
              </p>
              <p>
                Heures effectuées : {formatDecimalHours(stats.salaries.economy.completedHours)}
              </p>
            </div>
            <div className="font-semibold">
              Économie : {formatFcfa(stats.salaries.economy.savedAmount)}
            </div>
          </div>
        </div>
      </Card>
      ) : null}

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
