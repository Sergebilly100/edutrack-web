import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { DashboardQRAlertItem } from "@/modules/dashboard/dashboard.api"

type QRAlertsListProps = {
  alerts: DashboardQRAlertItem[]
  readIds: Record<string, boolean>
  onMarkRead: (id: string) => void
}

type TreatedAlert = {
  note: string
  treatedAt: string
}

const TREATED_STORAGE_KEY = "dashboard_qr_alert_treated"

const typeMeta: Record<DashboardQRAlertItem["type"], { label: string; className: string }> = {
  teacher_qr_mismatch: {
    label: "Salle mismatch",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  teacher_qr_missing_scan: {
    label: "Scan manquant",
    className: "bg-amber-100 text-amber-900 border-amber-200",
  },
  teacher_qr_scan_out_of_time: {
    label: "Hors horaire",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
}

const statusMeta: Record<DashboardQRAlertItem["status"], { label: string; className: string }> = {
  queued: { label: "En file", className: "bg-amber-100 text-amber-900 border-amber-200" },
  sent: { label: "Envoyé", className: "bg-green-100 text-green-700 border-green-200" },
  delivered: { label: "Livré", className: "bg-green-100 text-green-700 border-green-200" },
  failed: { label: "Échec", className: "bg-red-100 text-red-700 border-red-200" },
  unknown: { label: "Inconnu", className: "bg-slate-100 text-slate-700 border-slate-200" },
}

const parseTreated = (raw: string | null): Record<string, TreatedAlert> => {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) {
      return {}
    }

    return parsed as Record<string, TreatedAlert>
  } catch {
    return {}
  }
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

export default function QRAlertsList({ alerts, readIds, onMarkRead }: QRAlertsListProps) {
  const [selectedAlert, setSelectedAlert] = useState<DashboardQRAlertItem | null>(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [treatedAlerts, setTreatedAlerts] = useState<Record<string, TreatedAlert>>({})

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    setTreatedAlerts(parseTreated(window.localStorage.getItem(TREATED_STORAGE_KEY)))
  }, [])

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      const aDate = a.dateTime ? new Date(a.dateTime).getTime() : 0
      const bDate = b.dateTime ? new Date(b.dateTime).getTime() : 0
      return bDate - aDate
    })
  }, [alerts])

  const handleOpenAlert = (alert: DashboardQRAlertItem) => {
    setSelectedAlert(alert)
    setNoteDraft(treatedAlerts[alert.id]?.note ?? "")
    onMarkRead(alert.id)
  }

  const handleMarkAsTreated = () => {
    if (!selectedAlert) {
      return
    }

    const next = {
      ...treatedAlerts,
      [selectedAlert.id]: {
        note: noteDraft.trim(),
        treatedAt: new Date().toISOString(),
      },
    }

    setTreatedAlerts(next)

    if (typeof window !== "undefined") {
      window.localStorage.setItem(TREATED_STORAGE_KEY, JSON.stringify(next))
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Alertes QR</h2>

      {sortedAlerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune alerte QR.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/heure</TableHead>
                <TableHead>Prof</TableHead>
                <TableHead>Cours</TableHead>
                <TableHead>Salle prévue</TableHead>
                <TableHead>Salle scannée</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>SMS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAlerts.map((alert) => {
                const type = typeMeta[alert.type]
                const status = statusMeta[alert.status]
                const isRead = Boolean(readIds[alert.id])
                const treated = treatedAlerts[alert.id]

                return (
                  <TableRow
                    key={alert.id}
                    className={cn(
                      "cursor-pointer",
                      alert.isToday && "bg-amber-50/80",
                      !isRead && "font-medium"
                    )}
                    onClick={() => handleOpenAlert(alert)}
                  >
                    <TableCell>{formatDateTime(alert.dateTime)}</TableCell>
                    <TableCell>{alert.teacherName}</TableCell>
                    <TableCell>{alert.subject}</TableCell>
                    <TableCell>{alert.expectedRoom ?? "-"}</TableCell>
                    <TableCell>{alert.type === "teacher_qr_mismatch" ? (alert.scannedRoom ?? "-") : "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={type.className}>
                        {type.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                        {treated ? (
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                            Traité
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(selectedAlert)} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détail alerte QR</DialogTitle>
            <DialogDescription>
              {selectedAlert ? `${selectedAlert.teacherName} · ${selectedAlert.subject}` : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedAlert ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Date/heure</p>
                  <p>{formatDateTime(selectedAlert.dateTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p>{typeMeta[selectedAlert.type].label}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Salle prévue</p>
                  <p>{selectedAlert.expectedRoom ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Salle scannée</p>
                  <p>{selectedAlert.scannedRoom ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Classe</p>
                  <p>{selectedAlert.className ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Créneau</p>
                  <p>{selectedAlert.slotLabel ?? "-"}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Message SMS</p>
                <p className="rounded-md border bg-muted/30 p-2">{selectedAlert.message}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="director-note" className="text-xs text-muted-foreground">
                  Note du directeur
                </label>
                <Input
                  id="director-note"
                  placeholder="Ajouter une note de traitement"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={handleMarkAsTreated}>
                  Marquer comme traité
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
