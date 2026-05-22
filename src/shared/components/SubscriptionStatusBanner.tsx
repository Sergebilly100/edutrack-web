import { AlertCircle, CreditCard } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/shared/store/auth.store"

export function SubscriptionStatusBanner() {
  const tenant = useAuthStore((state) => state.tenant)
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()

  if (!tenant || !user) return null
  if (tenant.status !== "past_due") return null
  if (user.role !== "director" && user.role !== "staff") return null

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 border-b border-red-300 bg-red-50 px-4 py-3 text-red-900 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-100 sm:flex-row sm:items-center"
    >
      <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Abonnement en retard de paiement</p>
        <p className="mt-0.5 text-xs leading-snug sm:text-sm">
          Votre abonnement est en retard. Régularisez pour éviter la suspension de l&apos;accès.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border-red-300 bg-white text-red-700 hover:bg-red-100 hover:text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900"
        onClick={() => navigate("/subscriptions")}
      >
        <CreditCard className="h-4 w-4" />
        Régulariser
      </Button>
    </div>
  )
}
