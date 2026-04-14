import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardSmsItem } from "@/modules/dashboard/dashboard.api"

type AlertsListProps = {
  alerts: DashboardSmsItem[]
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const statusMeta: Record<DashboardSmsItem["status"], { label: string; className: string }> = {
  queued: { label: "En file", className: "bg-amber-100 text-amber-700 border-amber-200" },
  sent: { label: "Envoyé", className: "bg-green-100 text-green-700 border-green-200" },
  delivered: { label: "Livré", className: "bg-green-100 text-green-700 border-green-200" },
  failed: { label: "Échec", className: "bg-red-100 text-red-700 border-red-200" },
  unknown: { label: "Inconnu", className: "bg-slate-100 text-slate-700 border-slate-200" },
}

export default function AlertsList({ alerts }: AlertsListProps) {
  const limitedAlerts = alerts.slice(0, 5)

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">SMS récents</CardTitle>
      </CardHeader>
      <CardContent>
        {limitedAlerts.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Aucune notification récente.
          </div>
        ) : (
          <ul className="space-y-3">
            {limitedAlerts.map((alert) => {
              const status = statusMeta[alert.status]

              return (
                <li key={alert.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{alert.type}</p>
                    <Badge variant="outline" className={status.className}>
                      {status.label}
                    </Badge>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(alert.sentAt ?? alert.createdAt)}</p>

                  <p className="mt-2 text-sm text-foreground line-clamp-2">{alert.message || "Message indisponible"}</p>

                  <p className="mt-2 text-xs text-muted-foreground">Destinataire: {alert.recipientPhone}</p>
                </li>
              )
            })}
          </ul>
        )}

        {limitedAlerts.length > 0 ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Données limitées aux 5 dernières notifications
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Aucun SMS envoyé pour le moment
          </div>
        )}

        {limitedAlerts.some((item) => item.status === "sent" || item.status === "delivered") ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Des notifications ont bien été envoyées aujourd'hui
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
