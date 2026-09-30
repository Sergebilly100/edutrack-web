import type { QueryClient } from "@tanstack/react-query"
import { persistQueryCacheNow } from "@/shared/api/query-client"

// Each family contains school population or a count derived from it. Prefix
// invalidation covers every school year, class, filter and pagination variant.
export const CONFIRMED_POPULATION_QUERY_FAMILIES = [
  "enrollments",
  "students",
  "students-list",
  "academic",
  "dashboard",
  "dashboard-stats",
  "finance",
  "risks",
  "subscriptions",
  "report-cards-readiness",
  "report-cards-class",
  "class-completion",
  "evaluations-scope",
  "evaluation-review",
  "conduct-input-scope",
  "conduct-overview",
  "class-decisions",
  "student-roll-call",
  "attendance",
  "parent",
] as const

// These responses must not survive a browser restart with pre-confirmation
// data. Static school references and finance settings keep their offline copy.
const POPULATION_DATA_KEYS = [
  ["enrollments"],
  ["students"],
  ["students-list"],
  ["academic", "classes"],
  ["academic", "classes-for-report-cards"],
  ["academic", "classes-for-completion"],
  ["academic", "classes-for-subjects"],
  ["dashboard"],
  ["dashboard-stats"],
  ["finance", "financial-summary"],
  ["finance", "recovery"],
  ["finance", "student-search"],
  ["finance", "class-students-status"],
  ["finance", "financial-status"],
  ["finance", "account-statement"],
  ["finance", "payment-history"],
  ["finance", "cash-journal"],
  ["finance", "payments"],
  ["risks"],
  ["subscriptions"],
  ["report-cards-readiness"],
  ["report-cards-class"],
  ["class-completion"],
  ["evaluations-scope"],
  ["evaluation-review"],
  ["conduct-input-scope"],
  ["conduct-overview"],
  ["class-decisions"],
  ["student-roll-call"],
  ["attendance"],
  ["parent"],
] as const

// Workbox uses NetworkFirst for these responses. Remove pre-confirmation
// fallbacks before the active queries refetch, so a slow network cannot show
// an obsolete school population after a successful online confirmation.
const POPULATION_CACHE_NAMES = [
  "classes-cache",
  "students-cache",
  "dashboard-cache",
  "attendance-today-cache",
  "attendance-today-v1-cache",
  "subscriptions-cache",
] as const

export async function refreshConfirmedPopulation(queryClient: QueryClient): Promise<void> {
  if (typeof caches !== "undefined") {
    await Promise.allSettled(POPULATION_CACHE_NAMES.map(async (name) => caches.delete(name)))
  }
  await Promise.allSettled(CONFIRMED_POPULATION_QUERY_FAMILIES.map((key) =>
    queryClient.invalidateQueries({ queryKey: [key], refetchType: "none" }),
  ))
  await Promise.allSettled(POPULATION_DATA_KEYS.map((queryKey) =>
    queryClient.resetQueries({ queryKey: [...queryKey] }),
  ))
  await persistQueryCacheNow(queryClient)
}
