import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getCurrentMonth,
  getNextMonth,
  getPreviousMonth,
  getRecentMonthOptions,
  getSalarySummary,
  getSalaryUnpaidAlerts,
  getExportJobStatus,
  isFutureMonth,
} from "@/modules/salaries/salaries.api"
import { getPendingValidationCount } from "@/modules/validations/validations.api"

const STALE_TIME = 60_000

export function useSalarySummary(selectedMonth: string) {
  return useQuery({
    queryKey: ["salaries", "summary", selectedMonth],
    queryFn: () => getSalarySummary(selectedMonth),
    staleTime: STALE_TIME,
  })
}

export function useUnpaidAlerts() {
  return useQuery({
    queryKey: ["salaries", "unpaid-alerts", getCurrentMonth()],
    queryFn: () => getSalaryUnpaidAlerts(getCurrentMonth()),
    staleTime: STALE_TIME,
  })
}

export function useValidationCount() {
  return useQuery({
    queryKey: ["validations", "pending", "count", "salaries"],
    queryFn: getPendingValidationCount,
    staleTime: STALE_TIME,
    refetchInterval: 5 * 60_000,
  })
}

export function useExportJob(exportJobId: string | null) {
  return useQuery({
    queryKey: ["salaries", "export-job", exportJobId],
    queryFn: () => getExportJobStatus(exportJobId ?? ""),
    enabled: Boolean(exportJobId),
    staleTime: 0,
    refetchInterval: (query) => {
      const state = query.state.data?.state
      if (!state) return 2000
      return state === "done" || state === "failed" ? false : 2000
    },
  })
}

export function useMonthOptions() {
  const monthOptions = useMemo(() => getRecentMonthOptions(getCurrentMonth(), 18), [])
  const payMonthOptions = useMemo(() => {
    const current = getCurrentMonth()
    const minus1 = getPreviousMonth(current)
    const minus2 = getPreviousMonth(minus1)
    const plus1 = getNextMonth(current)
    return [minus2, minus1, current, plus1]
  }, [])

  return { monthOptions, payMonthOptions }
}

export { getCurrentMonth, isFutureMonth }
