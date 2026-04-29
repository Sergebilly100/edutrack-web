import { Navigate, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Building2, Users, Wallet } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSmsFeatureGlobalStats } from "@/modules/admin/admin.api"
import { StatCard } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

const formatFcfa = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

export default function AdminSmsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const globalStatsQuery = useQuery({
    queryKey: ["admin", "sms-feature", "global-stats"],
    queryFn: getSmsFeatureGlobalStats,
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
                  <TableHead>Commission restante</TableHead>
                  <TableHead>Dernier versement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.tenant_id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/schools/${row.tenant_id}?tab=sms-feature`)}
                  >
                    <TableCell className="font-medium">{row.school_name}</TableCell>
                    <TableCell>{row.subscriptions_active}</TableCell>
                    <TableCell>{formatFcfa(row.commission_remaining_fcfa)}</TableCell>
                    <TableCell>-</TableCell>
                  </TableRow>
                ))}
                {!globalStatsQuery.isLoading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
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
