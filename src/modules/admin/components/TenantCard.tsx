import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TenantListItem } from "@/modules/admin/admin.api"

type TenantCardProps = {
  tenant: TenantListItem
  lastAttendanceLabel: string
  mrrLabel: string
  onStats: (tenant: TenantListItem) => void
  onEdit: (tenant: TenantListItem) => void
  onSupport: (tenant: TenantListItem) => void
}

export default function TenantCard({
  tenant,
  lastAttendanceLabel,
  mrrLabel,
  onStats,
  onEdit,
  onSupport,
}: TenantCardProps) {
  return (
    <div className={tenant.churnRisk ? "rounded-lg border border-red-300 bg-red-50/40 p-4" : "rounded-lg border p-4"}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{tenant.name}</p>
          <p className="text-xs text-muted-foreground">{tenant.subdomain}</p>
        </div>
        <div className="flex gap-1">
          <Badge variant="outline">{tenant.plan}</Badge>
          <Badge variant={tenant.status === "active" ? "default" : "secondary"}>{tenant.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Pointage 7j</p>
          <p className="font-medium">{tenant.attendanceRate7d.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-muted-foreground">Dernier pointage</p>
          <p className="font-medium">{lastAttendanceLabel}</p>
        </div>
        <div>
          <p className="text-muted-foreground">MRR</p>
          <p className="font-medium">{mrrLabel}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Risque churn</p>
          <p className="font-medium">{tenant.churnRisk ? "Oui" : "Non"}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onStats(tenant)}>
          Stats
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEdit(tenant)}>
          Modifier
        </Button>
        <Button size="sm" onClick={() => onSupport(tenant)}>
          Accès support
        </Button>
      </div>
    </div>
  )
}

