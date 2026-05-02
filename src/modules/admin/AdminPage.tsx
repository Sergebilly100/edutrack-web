import { useEffect, useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { BarChart3, Building2, TrendingUp, Users } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getAdminMetrics,
  getSmsFeatureGlobalStats,
  getAllRecentPayments,
  getRevenueMetrics,
  getSmsDashboard,
  listSchools,
  type SchoolListItem,
  type TenantPlan,
  type TenantStatus,
} from "@/modules/admin/admin.api"
import AdminSchoolRow from "@/modules/admin/components/AdminSchoolRow"
import RevenueChart from "@/modules/admin/components/RevenueChart"
import SchoolFormModal from "@/modules/admin/components/SchoolFormModal"
import { StatCard } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

type FilterPlan = "all" | TenantPlan
type FilterStatus = "all" | TenantStatus

const PLAN_OPTIONS: TenantPlan[] = ["essential", "pro", "establishment"]
const STATUS_OPTIONS: TenantStatus[] = ["trial", "active", "suspended", "cancelled"]

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

const computeRetentionRate = (schools: SchoolListItem[]) => {
  if (schools.length === 0) {
    return 0
  }

  const now = Date.now()
  const activeOver30Days = schools.filter((school) => {
    if (!school.lastConnection) {
      return false
    }
    const diffDays = (now - new Date(school.lastConnection).getTime()) / (1000 * 60 * 60 * 24)
    return diffDays <= 30
  }).length

  return Math.round((activeOver30Days / schools.length) * 100)
}

export default function AdminPage() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const location = useLocation()

  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [planFilter, setPlanFilter] = useState<FilterPlan>("all")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("")
  const isSchoolsView = location.pathname.startsWith("/admin/schools")

  const schoolsQuery = useQuery({
    queryKey: ["admin", "schools", page, limit, planFilter, statusFilter, debouncedSearch],
    queryFn: () =>
      listSchools({
        page,
        limit,
        plan: planFilter !== "all" ? planFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: debouncedSearch || undefined,
      }),
    enabled: isSchoolsView,
  })

  const recentActiveSchoolsQuery = useQuery({
    queryKey: ["admin", "schools", "recent-active"],
    queryFn: () => listSchools({ page: 1, limit: 10, status: "active" }),
    enabled: !isSchoolsView,
  })

  const metricsQuery = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: getAdminMetrics,
  })

  const revenueQuery = useQuery({
    queryKey: ["admin", "revenue-metrics"],
    queryFn: getRevenueMetrics,
  })

  const smsDashboardQuery = useQuery({
    queryKey: ["admin", "sms", "dashboard"],
    queryFn: getSmsDashboard,
  })

  const schoolPaymentsQuery = useQuery({
    queryKey: ["admin", "school-payments", selectedSchoolId],
    queryFn: () => getAllRecentPayments(selectedSchoolId || undefined),
  })
  const smsFeatureGlobalStatsQuery = useQuery({
    queryKey: ["admin", "sms-feature", "global-stats"],
    queryFn: () => getSmsFeatureGlobalStats(),
  })

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [planFilter, statusFilter, debouncedSearch])

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== "super_admin") {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>Cette page est réservée au super admin.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const metrics = metricsQuery.data
  const visibleSchools = isSchoolsView
    ? schoolsQuery.data?.schools ?? []
    : recentActiveSchoolsQuery.data?.schools ?? []
  const retentionRate = computeRetentionRate(schoolsQuery.data?.schools ?? recentActiveSchoolsQuery.data?.schools ?? [])
  const dau7d = metrics?.dauLast7d[metrics.dauLast7d.length - 1]?.uniqueUsers ?? 0
  const pagination = schoolsQuery.data?.pagination

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSchoolsView ? "Écoles" : "Console EduTrack"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSchoolsView
              ? "Gestion des établissements (plan, statut, usage, configuration)."
              : "Monitoring multi-tenant et pilotage des écoles."}
          </p>
        </div>
        {isSchoolsView ? (
          <Button onClick={() => setCreateModalOpen(true)}>
            Créer une école
          </Button>
        ) : null}
      </header>

      {!isSchoolsView ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total écoles actives"
            value={metrics?.activeSchools ?? 0}
            subtitle="Écoles actives sur les 7 derniers jours"
            icon={<Building2 className="h-4 w-4" />}
            loading={metricsQuery.isLoading}
          />
          <StatCard
            title="MRR total FCFA"
            value={formatFcfa(metrics?.mrrTotalFcfa ?? 0)}
            subtitle="Revenus mensuels récurrents"
            icon={<TrendingUp className="h-4 w-4" />}
            variant="success"
            loading={metricsQuery.isLoading}
          />
          <StatCard
            title="DAU (7j)"
            value={dau7d}
            subtitle="Utilisateurs actifs aujourd'hui"
            icon={<Users className="h-4 w-4" />}
            loading={metricsQuery.isLoading}
          />
          <StatCard
            title="Commission SMS totale restante"
            value={formatFcfa((smsFeatureGlobalStatsQuery.data ?? []).reduce((acc, row) => acc + row.commission_remaining_fcfa, 0))}
            subtitle="Reversement à recevoir des écoles"
            icon={<TrendingUp className="h-4 w-4" />}
            variant={(smsFeatureGlobalStatsQuery.data ?? []).reduce((acc, row) => acc + row.commission_remaining_fcfa, 0) > 0 ? "danger" : "default"}
            loading={smsFeatureGlobalStatsQuery.isLoading}
          />
          <StatCard
            title="Taux de rétention"
            value={`${retentionRate}%`}
            subtitle="Écoles actives ≤ 30j / total"
            icon={<BarChart3 className="h-4 w-4" />}
            variant={retentionRate >= 70 ? "success" : retentionRate >= 40 ? "warning" : "danger"}
            loading={schoolsQuery.isLoading}
          />
        </section>
      ) : null}

      {metricsQuery.isError || revenueQuery.isError || schoolsQuery.isError || smsDashboardQuery.isError || recentActiveSchoolsQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger la console admin. Vérifiez la connexion API.</AlertDescription>
        </Alert>
      ) : null}

      {!isSchoolsView ? (
        revenueQuery.isLoading ? <Skeleton className="h-[280px] w-full rounded-lg" /> : <RevenueChart data={revenueQuery.data ?? []} />
      ) : null}

      {!isSchoolsView ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Paiements récents</CardTitle>
              <CardDescription>Historique des derniers paiements pour l&apos;école sélectionnée.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">École</p>
                <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une école" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleSchools.map((school) => (
                      <SelectItem key={school.tenantId} value={school.tenantId}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {schoolPaymentsQuery.isLoading ? (
                <Skeleton className="h-28 w-full rounded-md" />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(schoolPaymentsQuery.data ?? []).slice(0, 5).map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{new Date(payment.date).toLocaleDateString("fr-FR")}</TableCell>
                          <TableCell>{formatFcfa(payment.amountFcfa)}</TableCell>
                          <TableCell>{payment.provider}</TableCell>
                          <TableCell>{payment.status}</TableCell>
                        </TableRow>
                      ))}
                      {!schoolPaymentsQuery.isLoading && (schoolPaymentsQuery.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">
                            Aucun paiement enregistré.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              )}
              {schoolPaymentsQuery.isError ? (
                <Alert variant="destructive">
                  <AlertDescription>Impossible de charger les paiements de l&apos;école sélectionnée.</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">SMS envoyés ce mois</CardTitle>
              <CardDescription>Volume SMS mensuel pour l&apos;école sélectionnée.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {smsDashboardQuery.isLoading ? (
                <Skeleton className="h-20 w-full rounded-md" />
              ) : (
                <>
                  <p className="text-3xl font-bold">
                    {smsDashboardQuery.data?.bySchool.find((entry) => entry.tenantId === selectedSchoolId)?.sent ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Quota: {smsDashboardQuery.data?.bySchool.find((entry) => entry.tenantId === selectedSchoolId)?.quota ?? 0}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-4 md:p-6">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Recherche</p>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une école"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Plan</p>
            <Select value={planFilter} onValueChange={(value) => setPlanFilter(value as FilterPlan)}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {PLAN_OPTIONS.map((plan) => (
                  <SelectItem key={plan} value={plan}>
                    {plan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Statut</p>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>École</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Utilisateurs</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>SMS</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(isSchoolsView ? schoolsQuery.isLoading : recentActiveSchoolsQuery.isLoading) ? (
              <TableRow>
                <TableCell className="p-4 text-sm text-muted-foreground" colSpan={8}>
                  Chargement des écoles...
                </TableCell>
              </TableRow>
            ) : null}
            {!(isSchoolsView ? schoolsQuery.isLoading : recentActiveSchoolsQuery.isLoading) && visibleSchools.length === 0 ? (
              <TableRow>
                <TableCell className="p-4 text-sm text-muted-foreground" colSpan={8}>
                  Aucune école trouvée avec ces filtres.
                </TableCell>
              </TableRow>
            ) : null}
            {visibleSchools.map((school) => (
              <AdminSchoolRow
                key={school.tenantId}
                school={{
                  id: school.tenantId,
                  name: school.name,
                  city: school.city ?? "—",
                  plan: school.plan,
                  status: school.status,
                  usersCount: school.nbUsers,
                  lastConnectionAt: school.lastConnection,
                  mrrFcfa: school.mrrFcfa,
                  smsActive: (smsFeatureGlobalStatsQuery.data ?? []).some((item) => item.tenant_id === school.tenantId),
                }}
                onViewDetail={(target) => navigate(`/admin/schools/${target.id}`)}
                onOpenConfig={(target) => navigate(`/admin/schools/${target.id}`)}
              />
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {pagination
              ? `Page ${pagination.page} / ${Math.max(pagination.totalPages, 1)} · ${pagination.total} école(s)`
              : ""}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination || pagination.page <= 1 || schoolsQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination || pagination.page >= pagination.totalPages || schoolsQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      </section>

      <SchoolFormModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  )
}
