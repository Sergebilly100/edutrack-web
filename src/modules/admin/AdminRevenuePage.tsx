import { Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { BarChart3, TrendingUp, Wallet } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getRevenueSummary } from "@/modules/admin/admin.api"
import RevenueChart from "@/modules/admin/components/RevenueChart"
import { StatCard } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

export default function AdminRevenuePage() {
  const user = useAuthStore((state) => state.user)

  const revenueQuery = useQuery({
    queryKey: ["admin", "revenue", "summary"],
    queryFn: getRevenueSummary,
  })

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== "super_admin") {
    return (
      <Alert variant="destructive">
        <AlertDescription>Cette page est réservée au super admin.</AlertDescription>
      </Alert>
    )
  }

  const cards = revenueQuery.data?.cards

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Revenus des Écoles</h1>
        <p className="text-sm text-muted-foreground">Dashboard financier EduTrack CI.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="MRR total" value={formatFcfa(cards?.mrrTotalFcfa ?? 0)} icon={<Wallet className="h-4 w-4" />} loading={revenueQuery.isLoading} />
        <StatCard title="ARR" value={formatFcfa(cards?.arrFcfa ?? 0)} icon={<TrendingUp className="h-4 w-4" />} loading={revenueQuery.isLoading} />
        <StatCard title="Nouvelles souscriptions" value={cards?.newSubscriptionsThisMonth ?? 0} icon={<BarChart3 className="h-4 w-4" />} loading={revenueQuery.isLoading} />
        <StatCard title="Churn du mois" value={cards?.churnThisMonth ?? 0} icon={<BarChart3 className="h-4 w-4" />} loading={revenueQuery.isLoading} />
      </section>

      {revenueQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les données de revenus.</AlertDescription>
        </Alert>
      ) : null}

      <RevenueChart
        data={(revenueQuery.data?.monthly ?? []).map((entry) => ({
          month: entry.month,
          mrr_fcfa: entry.mrr_fcfa,
          payments_count: 0,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Revenus par école</CardTitle>
          <CardDescription>Montant mensuel, statut et échéance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>École</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Montant/mois</TableHead>
                  <TableHead>Dernière échéance</TableHead>
                  <TableHead>Mode paiement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(revenueQuery.data?.schools ?? []).map((row) => (
                  <TableRow key={row.tenantId}>
                    <TableCell>{row.school}</TableCell>
                    <TableCell>{row.plan}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{formatFcfa(row.amountPerMonth)}</TableCell>
                    <TableCell>{row.lastDueDate ? new Date(row.lastDueDate).toLocaleDateString("fr-FR") : "-"}</TableCell>
                    <TableCell>{row.paymentMode ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
