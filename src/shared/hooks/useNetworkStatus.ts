import { useEffect, useRef, useState } from "react"
import { onlineManager } from "@tanstack/react-query"

export type NetworkStatus = {
  isOnline: boolean
  wasOffline: boolean
}

/**
 * Source de vérité : navigator.onLine + events 'online'/'offline'.
 *
 * On évite délibérément un ping HTTP au boot. Le backend peut être
 * hébergé sur une origine différente (ex: localhost:3000 vs
 * 127.0.0.1:4173) et bloquer les requêtes par CORS - l'app croit
 * alors être offline en permanence, le bandeau orange reste affiché
 * et la sync auto ne se déclenche jamais.
 *
 * En cas de captive portal (rare), les requêtes API échoueront et
 * useOfflineMutation détecte les erreurs réseau pour requeue (voir
 * isNetworkLevelError dans useOfflineMutation.ts).
 */

function getInitialOnlineStatus() {
  if (typeof navigator === "undefined") {
    return true
  }

  return navigator.onLine
}

const setOnlineState = (
  nextOnline: boolean,
  setIsOnline: (value: boolean) => void
) => {
  onlineManager.setOnline(nextOnline)
  setIsOnline(nextOnline)
}

export function useNetworkStatus(): NetworkStatus {
  const initialOnlineStatus = getInitialOnlineStatus()
  const [isOnline, setIsOnline] = useState(initialOnlineStatus)
  const [wasOffline, setWasOffline] = useState(!initialOnlineStatus)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    onlineManager.setOnline(initialOnlineStatus)

    const clearWasOfflineTimeout = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const handleOnline = () => {
      clearWasOfflineTimeout()
      setOnlineState(true, setIsOnline)
      setWasOffline(true)

      // wasOffline reste true 5s pour permettre l'affichage du bandeau
      // "Connexion rétablie - synchronisation..." par OfflineIndicator.
      timeoutRef.current = window.setTimeout(() => {
        setWasOffline(false)
      }, 5000)
    }

    const handleOffline = () => {
      clearWasOfflineTimeout()
      setOnlineState(false, setIsOnline)
      setWasOffline(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      clearWasOfflineTimeout()
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return { isOnline, wasOffline }
}
