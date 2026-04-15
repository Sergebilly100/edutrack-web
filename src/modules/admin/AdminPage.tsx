import { useMemo, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { BarChart3, Building2, TrendingUp, Users } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getAdminMetrics,
  getRevenueMetrics,
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

  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [planFilter, setPlanFilter] = useState<FilterPlan>("all")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [search, setSearch] = useState("")
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const schoolsQuery = useQuery({
    queryKey: ["admin", "schools", page, limit],
    queryFn: () => listSchools({ page, limit }),
  })

  const metricsQuery = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: getAdminMetrics,
  })

  const revenueQuery = useQuery({
    queryKey: ["admin", "revenue-metrics"],
    queryFn: getRevenueMetrics,
  })

  const filteredSchools = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return (schoolsQuery.data?.schools ?? []).filter((school) => {
      const matchesPlan = planFilter === "all" || school.plan === planFilter
      const matchesStatus = statusFilter === "all" || school.status === statusFilter
      const matchesSearch = normalizedSearch.length === 0 || school.name.toLowerCase().includes(normalizedSearch)
      return matchesPlan && matchesStatus && matchesSearch
    })
  }, [schoolsQuery.data?.schools, planFilter, search, statusFilter])

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
  const retentionRate = computeRetentionRate(schoolsQuery.data?.schools ?? [])
  const dau7d = metrics?.dauLast7d[metrics.dauLast7d.length - 1]?.uniqueUsers ?? 0
  const pagination = schoolsQuery.data?.pagination

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Console EduTrack</h1>
          <p className="text-sm text-muted-foreground">Monitoring multi-tenant et pilotage des écoles.</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>Créer une école</Button>
      </header>

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
          title="Taux de rétention"
          value={`${retentionRate}%`}
          subtitle="Écoles actives ≤ 30j / total"
          icon={<BarChart3 className="h-4 w-4" />}
          variant={retentionRate >= 70 ? "success" : retentionRate >= 40 ? "warning" : "danger"}
          loading={schoolsQuery.isLoading}
        />
      </section>

      {metricsQuery.isError || revenueQuery.isError || schoolsQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger la console admin. Vérifiez la connexion API.</AlertDescription>
        </Alert>
      ) : null}

      {revenueQuery.isLoading ? <Skeleton className="h-[280px] w-full rounded-lg" /> : <RevenueChart data={revenueQuery.data ?? []} />}

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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schoolsQuery.isLoading ? (
              <TableRow>
                <TableCell className="p-4 text-sm text-muted-foreground" colSpan={7}>
                  Chargement des écoles...
                </TableCell>
              </TableRow>
            ) : null}
            {!schoolsQuery.isLoading && filteredSchools.length === 0 ? (
              <TableRow>
                <TableCell className="p-4 text-sm text-muted-foreground" colSpan={7}>
                  Aucune école trouvée avec ces filtres.
                </TableCell>
              </TableRow>
            ) : null}
            {filteredSchools.map((school) => (
              <AdminSchoolRow
                key={school.tenantId}
                school={{
                  id: school.tenantId,
                  name: school.name,
                  city: "Ville non renseignée",
                  plan: school.plan,
                  status: school.status,
                  usersCount: school.nbUsers,
                  lastConnectionAt: school.lastConnection,
                  mrrFcfa: school.mrrFcfa,
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

      <SchoolFormModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </div>
  )
}
