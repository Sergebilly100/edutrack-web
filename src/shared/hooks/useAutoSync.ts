import { useEffect } from "react"

import { toast } from "@/components/ui/use-toast"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import { syncOfflineQueue, useOfflineStore } from "@/shared/store/offline.store"

export function useAutoSync() {
  const { isOnline } = useNetworkStatus()
  const pendingCount = useOfflineStore((state) => state.queue.length)

  useEffect(() => {
    if (!isOnline || pendingCount === 0) {
      return
    }

    void (async () => {
      try {
        const syncedCount = await syncOfflineQueue()

        if (syncedCount > 0) {
          toast({
            title: "Synchronisation",
            description: `${syncedCount} pointage${syncedCount > 1 ? "s" : ""} synchronisé${syncedCount > 1 ? "s" : ""}`,
          })
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
  }, [isOnline, pendingCount])
}
