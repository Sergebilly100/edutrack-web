import { useQuery } from "@tanstack/react-query"
import { getPendingValidationCount } from "@/modules/validations/validations.api"

export function usePendingValidationCount(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["validations", "pending", "count"],
    queryFn: getPendingValidationCount,
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
}
