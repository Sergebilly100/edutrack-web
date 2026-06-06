import { useEffect, useState } from "react"
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
import { queryClient } from "@/shared/api/query-client"
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
  const hasHydrated = useOfflineStore((state) => state._hasHydrated)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  // navigator.onLine est plus fiable que useNetworkStatus pour activer le
  // bouton : isOnline attend une confirmation HTTP qui peut prendre 5s et
  // qui échoue dans certains cas (CORS, captive portal), bloquant le sync
  // manuel alors que le réseau est OK.
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  )
  useEffect(() => {
    const setOnline = () => setBrowserOnline(true)
    const setOffline = () => setBrowserOnline(false)
    window.addEventListener("online", setOnline)
    window.addEventListener("offline", setOffline)
    return () => {
      window.removeEventListener("online", setOnline)
      window.removeEventListener("offline", setOffline)
    }
  }, [])

  // Avant rehydratation IndexedDB, la queue lue depuis Zustand est vide
  // mais des items peuvent exister en stockage : on attend pour ne pas
  // afficher un faux 0 puis sauter à un vrai N.
  if (!hasHydrated || queue.length === 0) {
    return null
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const queuedBeforeSync = useOfflineStore.getState().queue.length
      const count = await syncOfflineQueue()
      // On ne fait PAS persist.rehydrate() ici : ça réécraserait la queue
      // mémoire (déjà à jour via removeFromQueue) avec l'état IndexedDB
      // qui est en retard à cause de la persistance async - ramenant les
      // items supprimés ("badge fantôme").
      // Si la sync a aboutit, on rafraîchit les vues actives - sans ça, le
      // pointage élève reste affiché comme "en attente" alors qu'il vient
      // d'être envoyé (le processor onSync n'est appelé qu'au niveau global,
      // les composants montés peuvent rater l'invalidation).
      if (count > 0) {
        void queryClient.refetchQueries({ type: "active" })
      }
      const remainingCount = useOfflineStore.getState().queue.length
      toast({
        title:
          count > 0
            ? `${count} action${count > 1 ? "s" : ""} synchronisée${count > 1 ? "s" : ""}`
            : remainingCount > 0
              ? "Synchronisation incomplète"
              : "Aucune action à synchroniser",
        description:
          count > 0
            ? remainingCount > 0
              ? `${remainingCount} action${remainingCount > 1 ? "s restent" : " reste"} en attente. Réessayez après stabilisation de la connexion.`
              : undefined
            : remainingCount > 0
              ? `${remainingCount} action${remainingCount > 1 ? "s n'ont" : " n'a"} pas pu être envoyée${remainingCount > 1 ? "s" : ""}.`
              : queuedBeforeSync > 0
                ? "La liste d'attente est déjà vide."
                : undefined,
      })
      if (remainingCount === 0) {
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
          browserOnline
            ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            : "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
        )}
        aria-label={`${queue.length} action${queue.length > 1 ? "s" : ""} en attente de synchronisation`}
        data-testid="offline-queue-badge"
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
              {browserOnline
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
              disabled={!browserOnline || syncing}
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
