import { CalendarDays, Download, Wallet } from "lucide-react"

import { StatCard } from "@/shared/components"
import { formatFcfa } from "@/shared/utils/formatting"

export function SalarySummaryCards({
  totalPending,
  totalPaid,
  vacataireCount,
  loading,
}: {
  totalPending: number
  totalPaid: number
  vacataireCount: number
  loading: boolean
}) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        title="Total à payer"
        value={formatFcfa(totalPending)}
        subtitle="Somme des salaires à régler"
        icon={<Wallet className="h-4 w-4" />}
        variant="warning"
        loading={loading}
      />
      <StatCard
        title="Total payé"
        value={formatFcfa(totalPaid)}
        subtitle="Somme des salaires payé"
        icon={<Download className="h-4 w-4" />}
        variant="success"
        loading={loading}
      />
      <StatCard
        title="Profs vacataires"
        value={vacataireCount}
        subtitle="En exercice ce mois"
        icon={<CalendarDays className="h-4 w-4" />}
        variant="default"
        loading={loading}
      />
    </section>
  )
}
