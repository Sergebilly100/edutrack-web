import { useEffect, useState } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export type InstallPlatform = "android" | "ios" | "desktop" | "other"

export type UseInstallPromptResult = {
  /** L'app tourne déjà en mode installé (standalone) → pas besoin de proposer. */
  isInstalled: boolean
  /** Un prompt natif d'installation est disponible (Chrome/Android/Desktop). */
  canPromptInstall: boolean
  platform: InstallPlatform
  /** Déclenche le prompt natif. Retourne true si l'utilisateur a accepté. */
  promptInstall: () => Promise<boolean>
}

const detectPlatform = (): InstallPlatform => {
  if (typeof navigator === "undefined") return "other"
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return "ios"
  if (/android/.test(ua)) return "android"
  if (/windows|macintosh|linux/.test(ua)) return "desktop"
  return "other"
}

const detectStandalone = (): boolean => {
  if (typeof window === "undefined") return false
  const standaloneDisplay =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  // iOS Safari expose navigator.standalone
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return standaloneDisplay || iosStandalone
}

export const useInstallPrompt = (): UseInstallPromptResult => {
  const [isInstalled, setIsInstalled] = useState(detectStandalone)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform] = useState(detectPlatform)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Empêche la mini-infobar Chrome par défaut ; on pilote notre propre UI.
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return choice.outcome === "accepted"
  }

  return {
    isInstalled,
    canPromptInstall: Boolean(deferredPrompt),
    platform,
    promptInstall,
  }
}
