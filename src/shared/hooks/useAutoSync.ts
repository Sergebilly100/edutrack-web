import { useEffect, useRef } from "react"

import { toast } from "@/components/ui/use-toast"
import { queryClient } from "@/shared/api/query-client"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import { syncOfflineQueue, useOfflineStore } from "@/shared/store/offline.store"

export function useAutoSync() {
  const { isOnline } = useNetworkStatus()
  const pendingCount = useOfflineStore((state) => state.queue.length)
  const previousOnlineRef = useRef(isOnline)

  useEffect(() => {
    const becameOnline = !previousOnlineRef.current && isOnline
    previousOnlineRef.current = isOnline

    if (!isOnline || pendingCount === 0) {
      if (becameOnline) {
        void queryClient.refetchQueries({ type: "active" })
      }
      return
    }

    void (async () => {
      try {
        const syncedCount = await syncOfflineQueue()
        void queryClient.refetchQueries({ type: "active" })

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
