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

// navigator.onLine returns true even on captive portals (WiFi with no real internet).
// We confirm actual connectivity with a lightweight HTTP ping to the API health endpoint
// before considering the device truly online.
// Disabled in test env to avoid real network calls.
function getHealthUrl() {
  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  if (!apiBase) {
    return "/health"
  }

  try {
    const url = new URL(apiBase, window.location.origin)
    url.pathname = "/health"
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return "/health"
  }
}

const PING_URL = getHealthUrl()
const PING_TIMEOUT_MS = 5000
const OFFLINE_RECHECK_MS = 10000
const PING_ENABLED = import.meta.env.MODE !== "test"

async function confirmConnectivity(): Promise<boolean> {
  if (!PING_ENABLED) {
    return true
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
    const response = await fetch(PING_URL, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timer)
    return response.ok
  } catch {
    return false
  }
}

export function useNetworkStatus(): NetworkStatus {
  const initialOnlineStatus = getInitialOnlineStatus()
  const [isOnline, setIsOnline] = useState(initialOnlineStatus)
  const [wasOffline, setWasOffline] = useState(!initialOnlineStatus)
  const timeoutRef = useRef<number | null>(null)
  const recheckIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    const clearWasOfflineTimeout = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const clearRecheckInterval = () => {
      if (recheckIntervalRef.current !== null) {
        window.clearInterval(recheckIntervalRef.current)
        recheckIntervalRef.current = null
      }
    }

    const handleOnline = () => {
      clearWasOfflineTimeout()

      const applyConfirmedOnline = () => {
        clearRecheckInterval()
        setIsOnline(true)
        setWasOffline(true)

        timeoutRef.current = window.setTimeout(() => {
          setWasOffline(false)
        }, 5000)
      }

      if (!PING_ENABLED) {
        applyConfirmedOnline()
        return
      }

      // Don't trust navigator.onLine alone — confirm with a real HTTP ping.
      void confirmConnectivity().then((confirmed) => {
        if (confirmed) {
          applyConfirmedOnline()
        } else {
          setIsOnline(false)
          setWasOffline(true)
          if (recheckIntervalRef.current === null) {
            recheckIntervalRef.current = window.setInterval(() => {
              if (navigator.onLine) {
                handleOnline()
              }
            }, OFFLINE_RECHECK_MS)
          }
        }
      })
    }

    const handleOffline = () => {
      clearWasOfflineTimeout()
      clearRecheckInterval()
      setIsOnline(false)
      setWasOffline(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      clearWasOfflineTimeout()
      clearRecheckInterval()
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return { isOnline, wasOffline }
}
