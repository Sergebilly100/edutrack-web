import { AlertBanner } from "@/shared/components/AlertBanner"

type WeekCoverageAlertProps = {
  nextWeekHasCoverage: boolean
  btnText: string
  onNavigateToSchedule: () => void
}

export function WeekCoverageAlert({ nextWeekHasCoverage, onNavigateToSchedule , btnText }: WeekCoverageAlertProps) {
  if (nextWeekHasCoverage) {
    return null
  }

  return (
    <div data-testid="week-coverage-alert">
      <AlertBanner
        type="warning"
        title="Semaine prochaine non configurée"
        message="L'emploi du temps de la semaine prochaine n'est pas configuré. Veuillez importer l'emploi du temps afin d'assurer une couverture complète."
        action={{
          label: btnText,
          onClick: onNavigateToSchedule, 
        }}
      />
    </div>
  )
}
