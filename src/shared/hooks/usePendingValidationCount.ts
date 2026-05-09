import { useQuery } from "@tanstack/react-query"
import { getPendingValidationCount } from "@/modules/validations/validations.api"

export function usePendingValidationCount() {
  return useQuery({
    queryKey: ["validations", "pending", "count"],
    queryFn: getPendingValidationCount,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
}
