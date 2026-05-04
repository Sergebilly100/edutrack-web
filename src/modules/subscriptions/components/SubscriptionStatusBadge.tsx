import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type SubscriptionStatus = "active" | "expired" | "cancelled"

type SubscriptionStatusBadgeProps = {
  status: SubscriptionStatus
  ends_at?: string
  className?: string
}

const getDaysUntil = (value?: string) => {
  if (!value) {
    return null
  }

  const endDate = new Date(`${value}T23:59:59.999Z`)
  if (Number.isNaN(endDate.getTime())) {
    return null
  }

  return Math.ceil((endDate.getTime() - Date.now()) / 86_400_000)
}

export default function SubscriptionStatusBadge({ status, ends_at, className }: SubscriptionStatusBadgeProps) {
  if (status === "expired") {
    return (
      <Badge className={cn("border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100", className)} variant="outline">
        Expiré
      </Badge>
    )
  }

  if (status === "cancelled") {
    return (
      <Badge className={cn("border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200", className)} variant="outline">
        <span className="line-through">Annulé</span>
      </Badge>
    )
  }

  const daysUntilEnd = getDaysUntil(ends_at)
  const expiresSoon = daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 7

  return (
    <Badge
      className={cn(
        expiresSoon
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          : "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200",
        className
      )}
      variant="outline"
    >
      {expiresSoon ? "Expire bientôt" : "Actif"}
    </Badge>
  )
}

export type { SubscriptionStatus, SubscriptionStatusBadgeProps }
