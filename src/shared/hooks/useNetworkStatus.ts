import { useEffect, useRef, useState } from "react"

export type NetworkStatus = {
  isOnline: boolean
  wasOffline: boolean
}

function getInitialOnlineStatus() {
  if (typeof navigator === "undefined") {
    return true
  }

  return navigator.onLine
}

export function useNetworkStatus(): NetworkStatus {
  const initialOnlineStatus = getInitialOnlineStatus()
  const [isOnline, setIsOnline] = useState(initialOnlineStatus)
  const [wasOffline, setWasOffline] = useState(!initialOnlineStatus)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const clearWasOfflineTimeout = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const handleOnline = () => {
      clearWasOfflineTimeout()
      setIsOnline(true)
      setWasOffline(true)

      timeoutRef.current = window.setTimeout(() => {
        setWasOffline(false)
      }, 5000)
    }

    const handleOffline = () => {
      clearWasOfflineTimeout()
      setIsOnline(false)
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
