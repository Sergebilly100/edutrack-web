import { useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { isAxiosError } from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import {
  createTenant,
  getTenants,
  impersonateTenant,
  updateTenant,
  type CreateTenantPayload,
  type TenantListItem,
  type TenantPlan,
  type TenantStatus,
} from "@/modules/admin/admin.api"
import TenantCard from "@/modules/admin/components/TenantCard"
import TenantStatsModal from "@/modules/admin/components/TenantStatsModal"
import { useAuthStore } from "@/shared/store/auth.store"

type FilterPlan = "all" | TenantPlan
type FilterStatus = "all" | TenantStatus
type FilterChurn = "all" | "true" | "false"

const PLAN_OPTIONS: TenantPlan[] = ["essential", "pro", "establishment"]
const STATUS_OPTIONS: TenantStatus[] = ["trial", "active", "suspended", "cancelled"]

const formatMrr = (value: number): string =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

const formatRelativeTime = (isoDate: string | null): string => {
  if (!isoDate) {
    return "Jamais"
  }

  const target = new Date(isoDate).getTime()
  const now = Date.now()
  const deltaMs = now - target
  if (deltaMs <= 0) {
    return "À l'instant"
  }

  const minutes = Math.floor(deltaMs / (60 * 1000))
  const hours = Math.floor(deltaMs / (60 * 60 * 1000))
  const days = Math.floor(deltaMs / (24 * 60 * 60 * 1000))

  if (minutes < 1) return "À l'instant"
  if (minutes < 60) return `Il y a ${minutes}m`
  if (hours < 24) return `Il y a ${hours}h`
  if (days < 7) return `Il y a ${days}j`
  return new Date(isoDate).toLocaleDateString("fr-FR")
}

const errorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    return (error.response?.data as { error?: string } | undefined)?.error ?? error.message
  }
  return error instanceof Error ? error.message : fallback
}

export default function AdminPage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [planFilter, setPlanFilter] = useState<FilterPlan>("all")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [churnFilter, setChurnFilter] = useState<FilterChurn>("all")

  const [statsTarget, setStatsTarget] = useState<TenantListItem | null>(null)
  const [editTarget, setEditTarget] = useState<TenantListItem | null>(null)
  const [editPlan, setEditPlan] = useState<TenantPlan>("essential")
  const [editStatus, setEditStatus] = useState<TenantStatus>("trial")

  const [createOpen, setCreateOpen] = useState(false)
  const [createPayload, setCreatePayload] = useState<CreateTenantPayload>({
    name: "",
    subdomain: "",
    plan: "essential",
    directorName: "",
    directorPhone: "",
    directorEmail: "",
  })

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants", page, limit, planFilter, statusFilter, churnFilter],
    queryFn: () =>
      getTenants({
        page,
        limit,
        plan: planFilter === "all" ? undefined : planFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        churnRisk: churnFilter === "all" ? undefined : churnFilter === "true",
      }),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { tenantId: string; plan: TenantPlan; status: TenantStatus }) =>
      updateTenant(payload.tenantId, { plan: payload.plan, status: payload.status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] })
      toast({ title: "Tenant mis à jour" })
      setEditTarget(null)
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: errorMessage(error, "Échec de la mise à jour tenant."),
        variant: "destructive",
      })
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateTenantPayload) =>
      createTenant({
        ...payload,
        directorEmail: payload.directorEmail?.trim() ? payload.directorEmail.trim() : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] })
      toast({ title: "Nouvelle école créée" })
      setCreateOpen(false)
      setCreatePayload({
        name: "",
        subdomain: "",
        plan: "essential",
        directorName: "",
        directorPhone: "",
        directorEmail: "",
      })
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: errorMessage(error, "Création du tenant impossible."),
        variant: "destructive",
      })
    },
  })

  const impersonateMutation = useMutation({
    mutationFn: (tenantId: string) => impersonateTenant(tenantId),
    onError: (error) => {
      toast({
        title: "Erreur",
        description: errorMessage(error, "Impersonation impossible."),
        variant: "destructive",
      })
    },
  })

  const columns = useMemo<ColumnDef<TenantListItem>[]>(
    () => [
      {
        header: "École",
        accessorKey: "name",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.subdomain}</p>
          </div>
        ),
      },
      {
        header: "Plan",
        accessorKey: "plan",
        cell: ({ row }) => <Badge variant="outline">{row.original.plan}</Badge>,
      },
      {
        header: "Statut",
        accessorKey: "status",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "active" ? "default" : "secondary"}>{row.original.status}</Badge>
        ),
      },
      {
        header: "Taux pointage 7j",
        accessorKey: "attendanceRate7d",
        cell: ({ row }) => `${row.original.attendanceRate7d.toFixed(2)}%`,
      },
      {
        header: "Dernier pointage",
        accessorKey: "lastAttendanceAt",
        cell: ({ row }) => formatRelativeTime(row.original.lastAttendanceAt),
      },
      {
        header: "MRR",
        accessorKey: "estimatedMrrFcfa",
        cell: ({ row }) => formatMrr(row.original.estimatedMrrFcfa),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setStatsTarget(row.original)}>
              Stats
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditTarget(row.original)
                setEditPlan(row.original.plan)
                setEditStatus(row.original.status)
              }}
            >
              Modifier
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                const result = await impersonateMutation.mutateAsync(row.original.id)
                const params = new URLSearchParams({
                  impersonation_token: result.token,
                  schema: result.schemaName,
                })
                window.open(`/dashboard?${params.toString()}`, "_blank", "noopener,noreferrer")
              }}
            >
              Accès support
            </Button>
          </div>
        ),
      },
    ],
    [impersonateMutation]
  )

  const table = useReactTable({
    data: tenantsQuery.data?.tenants ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: tenantsQuery.data?.pagination.totalPages ?? 0,
  })

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

  const summary = tenantsQuery.data?.summary
  const pagination = tenantsQuery.data?.pagination

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Console Super Admin</h1>
          <p className="text-sm text-muted-foreground">Monitoring et gestion de toutes les écoles EduTrack CI.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Nouvelle école</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Écoles actives</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary?.activeTenants ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Écoles trial</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary?.trialTenants ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">MRR total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatMrr(summary?.totalMrrFcfa ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risque churn</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{summary?.churnRiskTenants ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={planFilter} onValueChange={(value) => { setPlanFilter(value as FilterPlan); setPage(1) }}>
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
              <Label>Statut</Label>
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as FilterStatus); setPage(1) }}>
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
            <div className="space-y-2">
              <Label>Churn</Label>
              <Select value={churnFilter} onValueChange={(value) => { setChurnFilter(value as FilterChurn); setPage(1) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="true">À risque</SelectItem>
                  <SelectItem value="false">Non à risque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {tenantsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(tenantsQuery.error, "Impossible de charger les tenants.")}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-3 md:hidden">
            {(tenantsQuery.data?.tenants ?? []).map((tenant) => (
              <TenantCard
                key={tenant.id}
                tenant={tenant}
                lastAttendanceLabel={formatRelativeTime(tenant.lastAttendanceAt)}
                mrrLabel={formatMrr(tenant.estimatedMrrFcfa)}
                onStats={setStatsTarget}
                onEdit={(item) => {
                  setEditTarget(item)
                  setEditPlan(item.plan)
                  setEditStatus(item.status)
                }}
                onSupport={async (item) => {
                  const result = await impersonateMutation.mutateAsync(item.id)
                  const params = new URLSearchParams({
                    impersonation_token: result.token,
                    schema: result.schemaName,
                  })
                  window.open(`/dashboard?${params.toString()}`, "_blank", "noopener,noreferrer")
                }}
              />
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {tenantsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      Chargement des tenants...
                    </TableCell>
                  </TableRow>
                ) : null}

                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={row.original.churnRisk ? "bg-red-50/40 hover:bg-red-50/60" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

                {!tenantsQuery.isLoading && table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      Aucun tenant trouvé avec ces filtres.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {pagination ? `Page ${pagination.page} / ${Math.max(pagination.totalPages, 1)} · ${pagination.total} résultat(s)` : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination || page <= 1 || tenantsQuery.isFetching}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Précédent
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination || page >= pagination.totalPages || tenantsQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TenantStatsModal
        open={Boolean(statsTarget)}
        onOpenChange={(open) => {
          if (!open) setStatsTarget(null)
        }}
        tenantId={statsTarget?.id ?? null}
        tenantName={statsTarget?.name ?? null}
      />

      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le tenant</DialogTitle>
            <DialogDescription>Mettre à jour le plan et le statut du tenant sélectionné.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={editPlan} onValueChange={(value) => setEditPlan(value as TenantPlan)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((plan) => (
                    <SelectItem key={plan} value={plan}>
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={editStatus} onValueChange={(value) => setEditStatus(value as TenantStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={updateMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!editTarget) return
                updateMutation.mutate({
                  tenantId: editTarget.id,
                  plan: editPlan,
                  status: editStatus,
                })
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle école</DialogTitle>
            <DialogDescription>Créer un tenant avec son directeur initial.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Nom école</Label>
              <Input
                id="tenant-name"
                value={createPayload.name}
                onChange={(event) => setCreatePayload((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-subdomain">Subdomain</Label>
              <Input
                id="tenant-subdomain"
                value={createPayload.subdomain}
                onChange={(event) =>
                  setCreatePayload((current) => ({
                    ...current,
                    subdomain: event.target.value.toLowerCase().replace(/\s+/g, "-"),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={createPayload.plan}
                onValueChange={(value) => setCreatePayload((current) => ({ ...current, plan: value as TenantPlan }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((plan) => (
                    <SelectItem key={plan} value={plan}>
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="director-name">Nom directeur</Label>
              <Input
                id="director-name"
                value={createPayload.directorName}
                onChange={(event) =>
                  setCreatePayload((current) => ({ ...current, directorName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="director-phone">Téléphone directeur</Label>
              <Input
                id="director-phone"
                value={createPayload.directorPhone}
                onChange={(event) =>
                  setCreatePayload((current) => ({ ...current, directorPhone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="director-email">Email directeur (optionnel)</Label>
              <Input
                id="director-email"
                type="email"
                value={createPayload.directorEmail ?? ""}
                onChange={(event) =>
                  setCreatePayload((current) => ({ ...current, directorEmail: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              Annuler
            </Button>
            <Button
              onClick={() => createMutation.mutate(createPayload)}
              disabled={
                createMutation.isPending ||
                !createPayload.name ||
                !createPayload.subdomain ||
                !createPayload.directorName ||
                !createPayload.directorPhone
              }
            >
              {createMutation.isPending ? "Création..." : "Créer l'école"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

