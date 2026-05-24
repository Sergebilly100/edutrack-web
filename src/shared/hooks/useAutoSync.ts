import { useEffect, useState } from "react"

import { toast } from "@/components/ui/use-toast"
import { queryClient } from "@/shared/api/query-client"
import { syncOfflineQueue, useOfflineStore } from "@/shared/store/offline.store"

// Délai avant de re-tenter une sync si des items sont restés en queue
// (processor manquant temporairement, échec serveur transient).
const SYNC_RETRY_DELAY_MS = 15_000

/**
 * Source de vérité réseau pour la synchro : navigator.onLine + events
 * 'online'/'offline'. On n'utilise pas useNetworkStatus ici parce que son
 * ping HTTP peut rester bloqué (CORS, latence, captive portal) et nous
 * faire croire à tort qu'on est offline alors que le navigateur est en
 * ligne — ce qui empêchait la sync auto de se déclencher.
 */
function useBrowserOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  )
  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])
  return online
}

export function useAutoSync() {
  const isOnline = useBrowserOnline()
  const pendingCount = useOfflineStore((state) => state.queue.length)
  const hasHydrated = useOfflineStore((state) => state._hasHydrated)

  useEffect(() => {
    if (!hasHydrated) return

    if (!isOnline || pendingCount === 0) {
      return
    }

    let cancelled = false
    let retryTimer: number | undefined

    void (async () => {
      try {
        const syncedCount = await syncOfflineQueue()
        if (cancelled) return
        void queryClient.refetchQueries({ type: "active" })

        if (syncedCount > 0) {
          toast({
            title: "Synchronisation",
            description: `${syncedCount} pointage${syncedCount > 1 ? "s" : ""} synchronisé${syncedCount > 1 ? "s" : ""}`,
          })
        }

        // S'il reste des items (processor manquant temporairement, échec
        // serveur transient), on retente dans 15s sans attendre qu'un
        // changement d'état React relance l'effet.
        const remaining = useOfflineStore.getState().queue.length
        if (remaining > 0 && navigator.onLine) {
          retryTimer = window.setTimeout(() => {
            void syncOfflineQueue()
              .then(() => queryClient.refetchQueries({ type: "active" }))
              .catch((error) => {
                console.error("[auto-sync] retry sync failed", error)
              })
          }, SYNC_RETRY_DELAY_MS)
        }
      } catch (error) {
        console.error("[auto-sync] Failed to sync offline queue", error)
        toast({
          variant: "destructive",
          title: "Synchronisation échouée",
          description: "Impossible de synchroniser les pointages. Réessayez manuellement.",
        })
      }
    })()

    return () => {
      cancelled = true
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer)
      }
    }
  }, [hasHydrated, isOnline, pendingCount])
}
