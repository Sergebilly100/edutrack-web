import { Badge } from "@/components/ui/badge"

type SubscriptionStatus = "active" | "expired" | "cancelled"

type SubscriptionStatusBadgeProps = {
  status: SubscriptionStatus
  ends_at?: string
  className?: string
}

export default function SubscriptionStatusBadge({ status, className }: SubscriptionStatusBadgeProps) {
  if (status === "expired") {
    return (
      <Badge className={className} variant="secondary">
        Expiré
      </Badge>
    )
  }

  if (status === "cancelled") {
    return (
      <Badge className={className} variant="secondary">
        <span className="line-through">Annulé</span>
      </Badge>
    )
  }

  return (
    <Badge className={className} variant="default">
      Actif
    </Badge>
  )
}

export type { SubscriptionStatus, SubscriptionStatusBadgeProps }
