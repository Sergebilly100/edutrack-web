import { useQuery } from "@tanstack/react-query"
import { fetchParentSchoolConfig } from "@/modules/parent-portal/parent.api"
import { parseActiveSchoolYear } from "@/shared/hooks/useSchoolYearMonths"
import { addMonths, getCurrentMonth } from "@/shared/utils/month"

type ParentSchoolYearMonthsResult = {
  months: string[]
  isLoading: boolean
}

/**
 * Charge les mois de l'année scolaire pour le portail parent
 * (utilise /parent/school-config, accessible avec le JWT parent).
 * Les mois futurs sont exclus. Fallback : 6 derniers mois.
 */
export function useParentSchoolYearMonths(): ParentSchoolYearMonthsResult {
  const configQuery = useQuery({
    queryKey: ["parent", "school-config"],
    queryFn: fetchParentSchoolConfig,
    staleTime: 5 * 60 * 1000,
  })

  const today = getCurrentMonth()
  const bounds = parseActiveSchoolYear(configQuery.data?.activeSchoolYear)

  let months: string[]
  if (bounds) {
    months = []
    let cursor = bounds.maxMonth < today ? bounds.maxMonth : today
    while (cursor >= bounds.minMonth) {
      months.push(cursor)
      cursor = addMonths(cursor, -1)
    }
  } else {
    // Fallback : 6 derniers mois (comportement original du portail parent)
    months = Array.from({ length: 6 }, (_, i) => addMonths(today, -i))
  }

  return { months, isLoading: configQuery.isLoading }
}
