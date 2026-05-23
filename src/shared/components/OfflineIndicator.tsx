import { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { OfflineIcon, OnlineIcon } from "@/shared/components/icons"
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus"

type ForceState = "auto" | "offline" | "recovered"

type OfflineIndicatorProps = {
  forceState?: ForceState
  // Indique si la page courante supporte vraiment l'offline (mutations
  // en queue + sync auto). Si false, le bandeau prévient l'utilisateur
  // que ses actions échoueront au lieu de prétendre qu'elles sont
  // sauvegardées localement.
  offlineCapable?: boolean
}

export function OfflineIndicator({
  forceState = "auto",
  offlineCapable = false,
}: OfflineIndicatorProps) {
  const { isOnline, wasOffline } = useNetworkStatus()
  const [showRecovered, setShowRecovered] = useState(false)
  const previousIsOnline = useRef(isOnline)

  useEffect(() => {
    if (forceState !== "auto") {
      return
    }

    if (previousIsOnline.current === false && isOnline && wasOffline) {
      setShowRecovered(true)
      const timeout = window.setTimeout(() => {
        setShowRecovered(false)
      }, 3000)

      previousIsOnline.current = isOnline
      return () => window.clearTimeout(timeout)
    }

    previousIsOnline.current = isOnline

    return undefined
  }, [forceState, isOnline, wasOffline])

  const mode = useMemo(() => {
    if (forceState === "offline") {
      return "offline"
    }

    if (forceState === "recovered") {
      return "recovered"
    }

    if (!isOnline) {
      return "offline"
    }

    if (showRecovered) {
      return "recovered"
    }

    return "hidden"
  }, [forceState, isOnline, showRecovered])

  const isVisible = mode !== "hidden"

  return (
    <div
      className={cn(
        "sticky top-0 z-50 overflow-hidden transition-all duration-300 ease-in-out",
        isVisible ? "max-h-12" : "max-h-0"
      )}
      aria-live="polite"
    >
      {mode === "offline" ? (
        <div
          className={cn(
            "text-white text-sm font-medium py-2 px-4 flex items-center gap-2",
            offlineCapable ? "bg-amber-500" : "bg-red-600"
          )}
        >
          <OfflineIcon className="h-4 w-4" />
          <span>
            {offlineCapable
              ? "Hors ligne - vos actions sont sauvegardées localement"
              : "Hors ligne - les actions sur cette page sont indisponibles"}
          </span>
        </div>
      ) : null}

      {mode === "recovered" ? (
        <div className="bg-green-600 text-white text-sm font-medium py-2 px-4 flex items-center gap-2">
          <OnlineIcon className="h-4 w-4" />
          <span>
            {offlineCapable
              ? "Connexion rétablie - synchronisation en cours..."
              : "Connexion rétablie"}
          </span>
        </div>
      ) : null}
    </div>
  )
}
