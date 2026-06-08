import { DashboardStatsCards } from "@/modules/dashboard/components/DashboardStatsCards"
import PresenceChart from "@/modules/dashboard/components/PresenceChart"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import type { DashboardHistoryPoint } from "@/modules/dashboard/dashboard.api"

type OverviewTabProps = {
  canViewAttendance: boolean
  canViewTeachers: boolean
  canViewSalary: boolean
  canViewSubscriptions: boolean
  weeklyAbsenceCount: number
  nextWeekHasCoverage?: boolean
  historyData: DashboardHistoryPoint[]
}

export function OverviewTab({
  canViewAttendance,
  canViewTeachers,
  canViewSalary,
  canViewSubscriptions,
  weeklyAbsenceCount,
  nextWeekHasCoverage,
  historyData,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Stats globales */}
      <div>
        <DashboardStatsCards
          showTeacherCard={canViewAttendance || canViewTeachers}
          showStudentCard={canViewAttendance}
          showSalaryCard={canViewSalary}
          showSubscriptionCard={canViewSubscriptions}
        />
      </div>

      {/* Alertes système */}
      {weeklyAbsenceCount > 5 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {weeklyAbsenceCount} absences professeurs sur les 7 derniers jours.
            Consultez l'onglet "Présences" pour plus de détails.
          </AlertDescription>
        </Alert>
      ) : null}

      {nextWeekHasCoverage === false ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            L'emploi du temps de la semaine prochaine n'est pas encore configuré.
            Consultez la section "Emploi du temps".
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Graphique évolution présences 7j */}
      {canViewAttendance ? <PresenceChart data={historyData} /> : null}
    </div>
  )
}
