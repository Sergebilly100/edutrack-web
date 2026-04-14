import { useEffect, useRef } from "react"

import { toast } from "@/components/ui/use-toast"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"
import { syncOfflineQueue } from "@/shared/store/offline.store"

export function useAutoSync() {
  const { isOnline } = useNetworkStatus()
  const previousOnlineRef = useRef(isOnline)

  useEffect(() => {
    const becameOnline = !previousOnlineRef.current && isOnline
    previousOnlineRef.current = isOnline

    if (!becameOnline) {
      return
    }

    void (async () => {
      const syncedCount = await syncOfflineQueue()

      if (syncedCount > 0) {
        toast({
          title: "Synchronisation",
          description: `${syncedCount} pointages synchronisés`,
        })
      }
    })()
  }, [isOnline])
}
