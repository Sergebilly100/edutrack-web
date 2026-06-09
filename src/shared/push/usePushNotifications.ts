import { useCallback, useEffect, useState } from "react"

import { removePushSubscription, sendPushSubscription, type PushAudience } from "./push.api"

export type { PushAudience }

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// Conversion clé VAPID base64url → Uint8Array (format attendu par pushManager).
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export type PushPermissionState = "unsupported" | "default" | "granted" | "denied"

export type UsePushNotificationsResult = {
  /** Le navigateur supporte le Web Push ET une clé VAPID est configurée. */
  isSupported: boolean
  permission: PushPermissionState
  isSubscribed: boolean
  isBusy: boolean
  /** Demande la permission puis s'abonne. Retourne true si l'abonnement a réussi. */
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
}

const detectSupport = (): boolean =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window &&
  Boolean(VAPID_PUBLIC_KEY)

export const usePushNotifications = (audience: PushAudience): UsePushNotificationsResult => {
  const [isSupported] = useState(detectSupport)
  const [permission, setPermission] = useState<PushPermissionState>("default")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  // État initial : permission courante + abonnement déjà présent.
  useEffect(() => {
    let cancelled = false

    if (!isSupported) {
      setPermission("unsupported")
      return
    }

    const refreshSubscriptionState = async (): Promise<void> => {
      setPermission(Notification.permission as PushPermissionState)
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled) {
          setIsSubscribed(Notification.permission === "granted" && Boolean(sub))
        }
      } catch {
        if (!cancelled) {
          setIsSubscribed(false)
        }
      }
    }

    void refreshSubscriptionState()

    let permissionStatus: PermissionStatus | null = null
    if ("permissions" in navigator) {
      void navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((status) => {
          permissionStatus = status
          status.onchange = () => {
            void refreshSubscriptionState()
          }
        })
        .catch(() => {
          permissionStatus = null
        })
    }

    return () => {
      cancelled = true
      if (permissionStatus) {
        permissionStatus.onchange = null
      }
    }
  }, [isSupported])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !VAPID_PUBLIC_KEY) return false
    setIsBusy(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result as PushPermissionState)
      if (result !== "granted") {
        return false
      }

      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // Cast : le type DOM attend BufferSource ; notre Uint8Array en est un.
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        }))

      await sendPushSubscription(audience, subscription.toJSON())
      setPermission("granted")
      setIsSubscribed(true)
      return true
    } catch {
      setIsSubscribed(false)
      return false
    } finally {
      setIsBusy(false)
    }
  }, [audience, isSupported])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return
    setIsBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await removePushSubscription(audience, subscription.endpoint).catch(() => {
          /* best-effort : on désabonne quand même côté navigateur */
        })
        await subscription.unsubscribe()
      }
      setIsSubscribed(false)
    } finally {
      setIsBusy(false)
    }
  }, [audience, isSupported])

  return { isSupported, permission, isSubscribed, isBusy, subscribe, unsubscribe }
}
