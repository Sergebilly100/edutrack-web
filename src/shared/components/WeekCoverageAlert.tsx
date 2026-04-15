import { AlertBanner } from "@/shared/components/AlertBanner"

type WeekCoverageAlertProps = {
  nextWeekHasCoverage: boolean
  onNavigateToSchedule: () => void
}

export function WeekCoverageAlert({ nextWeekHasCoverage, onNavigateToSchedule }: WeekCoverageAlertProps) {
  if (nextWeekHasCoverage) {
    return null
  }

  return (
    <AlertBanner
      type="warning"
      title="Semaine prochaine non configurée"
      message="L'emploi du temps de la semaine prochaine n'est pas configuré"
      action={{
        label: "Configurer l'EDT",
        onClick: onNavigateToSchedule,
      }}
    />
  )
}
