import { useState } from "react"
import { CloudOff, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import { syncOfflineQueue, useOfflineStore } from "@/shared/store/offline.store"

// Étiquettes lisibles par les utilisateurs pour chaque type d'action en queue.
// Les clés viennent de OFFLINE_QUEUE_KEYS (offline-processors.ts) + celles
// enregistrées localement par les composants (attendance, validations, etc.).
const QUEUE_KEY_LABELS: Record<string, string> = {
  "salary-mark-paid": "Paiement salaire",
  "salary-compute": "Calcul des salaires",
  "schedule-update": "Modification de créneau",
  "schedule-delete": "Suppression de créneau",
  "schedule-delete-from-date": "Suppression de créneau",
  "attendance-checkin": "Pointage début",
  "attendance-qr-scan": "Scan QR",
  "attendance-qr-skip": "Saut QR",
  "attendance-qr-end-scan": "Scan QR de fin",
  "attendance-qr-end-skip": "Saut QR de fin",
  "attendance-students-bulk": "Pointage élèves",
  "attendance-checkout": "Fin de cours",
  "validation-approve": "Validation",
  "validation-reject": "Refus de validation",
  "student-absence-excuse": "Justification d'absence",
}

const labelFor = (queueKey: string): string =>
  QUEUE_KEY_LABELS[queueKey] ?? queueKey

export function OfflineQueueBadge() {
  const queue = useOfflineStore((state) => state.queue)
  const { isOnline } = useNetworkStatus()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  if (queue.length === 0) {
    return null
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const count = await syncOfflineQueue()
      toast({
        title:
          count > 0
            ? `${count} action${count > 1 ? "s" : ""} synchronisée${count > 1 ? "s" : ""}`
            : "Aucune action synchronisée",
        description:
          count > 0
            ? undefined
            : "Réessayez une fois la connexion stabilisée.",
      })
      if (count === queue.length) {
        setOpen(false)
      }
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "h-8 gap-1.5 px-2 text-xs text-bold",
          isOnline
            ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            : "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
        )}
        aria-label={`${queue.length} action${queue.length > 1 ? "s" : ""} en attente de synchronisation`}
      >
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        <span className="font-semibold">{queue.length}</span>
        <span className="hidden sm:inline">Hors ligne en attente</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actions en attente de synchronisation</DialogTitle>
            <DialogDescription>
              {isOnline
                ? "Ces actions seront envoyées automatiquement. Vous pouvez aussi forcer un envoi maintenant."
                : "Ces actions seront envoyées dès le retour de la connexion."}
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {queue.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <span>{labelFor(item.queueKey)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.timestamp).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Fermer
            </Button>
            <Button
              type="button"
              onClick={() => void handleSyncNow()}
              disabled={!isOnline || syncing}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", syncing && "animate-spin")}
                aria-hidden
              />
              {syncing ? "Synchronisation…" : "Synchroniser maintenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
