import { useQuery } from "@tanstack/react-query"
import { fetchSchoolConfig } from "@/modules/settings/settings.api"
import { addMonths, formatMonthLabel, getCurrentMonth } from "@/shared/utils/month"

export type SchoolYearBounds = {
  minMonth: string
  maxMonth: string
}

/**
 * Parse "MM/YYYY - MM/YYYY" → { minMonth: "YYYY-MM", maxMonth: "YYYY-MM" }
 * Retourne null si le format est absent ou invalide.
 */
export function parseActiveSchoolYear(raw: string | null | undefined): SchoolYearBounds | null {
  if (!raw) return null
  const match = raw.trim().match(/^(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, startMonth, startYear, endMonth, endYear] = match
  return {
    minMonth: `${startYear}-${startMonth}`,
    maxMonth: `${endYear}-${endMonth}`,
  }
}

type UseSchoolYearMonthsResult = {
  bounds: SchoolYearBounds | null
  monthsInYear: string[]
  isLoading: boolean
}

/**
 * Charge les bornes de l'année scolaire depuis la config école.
 * Si aucune config disponible, retourne null (pas de restriction).
 */
export function useSchoolYearMonths(): UseSchoolYearMonthsResult {
  const configQuery = useQuery({
    queryKey: ["settings", "school-config", "month-picker"],
    queryFn: fetchSchoolConfig,
    staleTime: 5 * 60 * 1000,
  })

  const bounds = parseActiveSchoolYear(configQuery.data?.school.activeSchoolYear)

  // Construit du plus récent au plus ancien, en excluant les mois futurs
  const monthsInYear: string[] = []
  if (bounds) {
    const today = getCurrentMonth()
    let cursor = bounds.maxMonth <= today ? bounds.maxMonth : today
    while (cursor >= bounds.minMonth) {
      monthsInYear.push(cursor)
      cursor = addMonths(cursor, -1)
    }
  }

  return {
    bounds,
    monthsInYear,
    isLoading: configQuery.isLoading,
  }
}

export { formatMonthLabel }
