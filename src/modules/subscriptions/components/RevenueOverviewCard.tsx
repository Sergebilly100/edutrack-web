import { Coins, PiggyBank, Wallet } from "lucide-react"

import { StatCard } from "@/shared/components/StatCard"

type RevenueSummary = {
  total_collected_fcfa: number
  commission_due_fcfa: number
  commission_remaining_fcfa: number
}

type RevenueOverviewCardProps = {
  summary: RevenueSummary
  loading?: boolean
}

const formatFcfa = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

export default function RevenueOverviewCard({ summary, loading = false }: RevenueOverviewCardProps) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Encaissé ce mois"
        value={formatFcfa(summary.total_collected_fcfa)}
        icon={<Wallet className="h-4 w-4" />}
        variant="default"
        loading={loading}
      />
      <StatCard
        title="Commission EduTrack"
        value={formatFcfa(summary.commission_due_fcfa)}
        icon={<Coins className="h-4 w-4" />}
        variant={summary.commission_due_fcfa > 0 ? "warning" : "default"}
        loading={loading}
      />
      <StatCard
        title="Reste à reverser"
        value={formatFcfa(summary.commission_remaining_fcfa)}
        icon={<PiggyBank className="h-4 w-4" />}
        variant={summary.commission_remaining_fcfa > 0 ? "danger" : "default"}
        loading={loading}
      />
    </section>
  )
}

export type { RevenueOverviewCardProps, RevenueSummary }
