import { useQuery } from "@tanstack/react-query"

import { getEndOfYearReviewStatus } from "@/modules/class-decisions/class-decisions.api"
import { useAuthStore } from "@/shared/store/auth.store"

export const END_OF_YEAR_REVIEW_STATUS_KEY = ["class-decisions", "review-status"] as const

export function useEndOfYearReviewStatus() {
  const role = useAuthStore((state) => state.user?.role)
  const permissions = useAuthStore((state) => state.permissions)
  const canView = role === "director" || permissions.includes("class_decisions.view")

  return useQuery({
    queryKey: END_OF_YEAR_REVIEW_STATUS_KEY,
    queryFn: getEndOfYearReviewStatus,
    enabled: canView,
    staleTime: 5 * 60_000,
  })
}
