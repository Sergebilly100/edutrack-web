import { useQuery } from "@tanstack/react-query"

import { getSubscriptionAvailability } from "./subscriptions.api"

/** Disponibilité des nouveaux abonnements (année active non terminée, mois restants) — règle appliquée aussi par l'API. */
export function useSubscriptionAvailability(enabled = true) {
  return useQuery({
    queryKey: ["subscriptions", "availability"],
    queryFn: getSubscriptionAvailability,
    staleTime: 60_000,
    enabled,
  })
}
