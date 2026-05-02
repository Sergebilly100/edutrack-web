import { Navigate, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Building2, ChevronLeft, ChevronRight, Users, Wallet } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSmsFeatureGlobalStats } from "@/modules/admin/admin.api"
import { StatCard } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"
import { useState } from "react"

const formatFcfa = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`
const toMonth = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
const monthLabel = (month: string) => {
  const [year, m] = month.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, (m ?? 1) - 1, 1)))
}

export default function AdminSmsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [monthCursor, setMonthCursor] = useState<Date>(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)))
  const month = toMonth(monthCursor)
  const currentMonth = toMonth(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)))
  const canGoNextMonth = month !== currentMonth

  const globalStatsQuery = useQuery({
    queryKey: ["admin", "sms-feature", "global-stats", month],
    queryFn: () => getSmsFeatureGlobalStats(month),
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

  const rows = globalStatsQuery.data ?? []
  const totalRemaining = rows.reduce((acc, row) => acc + row.commission_remaining_fcfa, 0)

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Revenus SMS — Toutes les écoles</h1>
        <p className="text-sm text-muted-foreground">
          Suivi global des commissions SMS en attente de reversement.
        </p>
        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="outline" size="icon" onClick={() => setMonthCursor((prev) => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() - 1, 1)))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-40 text-center text-sm capitalize">{monthLabel(month)}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!canGoNextMonth}
            onClick={() => setMonthCursor((prev) => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 1)))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Commission SMS totale restante"
          value={formatFcfa(totalRemaining)}
          icon={<Wallet className="h-4 w-4" />}
          variant={totalRemaining > 0 ? "danger" : "default"}
          loading={globalStatsQuery.isLoading}
        />
        <StatCard
          title="Écoles actives"
          value={rows.length}
          icon={<Building2 className="h-4 w-4" />}
          loading={globalStatsQuery.isLoading}
        />
        <StatCard
          title="Abonnements actifs"
          value={rows.reduce((acc, row) => acc + row.subscriptions_active, 0)}
          icon={<Users className="h-4 w-4" />}
          loading={globalStatsQuery.isLoading}
        />
      </section>

      {globalStatsQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les revenus SMS globaux.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Écoles avec feature SMS activée</CardTitle>
          <CardDescription>Triées par commission restante décroissante.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>École</TableHead>
                  <TableHead>Abonnements actifs</TableHead>
                  <TableHead>Total encaissé</TableHead>
                  <TableHead>SMS utilisés</TableHead>
                  <TableHead>Commission restante</TableHead>
                  <TableHead>Dernier versement</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.tenant_id}>
                    <TableCell className="font-medium">{row.school_name}</TableCell>
                    <TableCell>{row.subscriptions_active}</TableCell>
                    <TableCell>{formatFcfa(row.total_collected_fcfa)}</TableCell>
                    <TableCell>{row.sms_sent_this_month}</TableCell>
                    <TableCell>{formatFcfa(row.commission_remaining_fcfa)}</TableCell>
                    <TableCell>{row.last_payment_at ? new Date(row.last_payment_at).toLocaleString("fr-FR") : "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/admin/schools/${row.tenant_id}?tab=sms-feature`)}>
                        Gérer reversements
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!globalStatsQuery.isLoading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      Aucune école avec feature SMS activée.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
