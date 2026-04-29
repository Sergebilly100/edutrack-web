import { Badge } from "@/components/ui/badge"

type SubscriptionStatus = "active" | "expired" | "cancelled"

type SubscriptionStatusBadgeProps = {
  status: SubscriptionStatus
  ends_at: string
  className?: string
}

const toStartOfDay = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`)

const formatDateFr = (isoDate: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(toStartOfDay(isoDate))

const daysBetween = (from: Date, to: Date) => {
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.floor((toUtc - fromUtc) / (24 * 60 * 60 * 1000))
}

export default function SubscriptionStatusBadge({ status, ends_at, className }: SubscriptionStatusBadgeProps) {
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

  const now = new Date()
  const endDate = toStartOfDay(ends_at)
  const remainingDays = daysBetween(now, endDate)

  if (remainingDays <= 7) {
    return (
      <Badge className={className} variant="destructive">
        Expire bientôt
      </Badge>
    )
  }

  if (remainingDays <= 30) {
    return (
      <Badge className={className} variant="outline">
        Expire le {formatDateFr(ends_at)}
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
