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
  /**
   * Navigateur qui ne sait pas installer une PWA (navigateur in-app type
   * Facebook/WhatsApp, ou Firefox Android) → il faut conseiller d'ouvrir dans Chrome.
   */
  isUnsupportedBrowser: boolean
  /** Déclenche le prompt natif. Retourne true si l'utilisateur a accepté. */
  promptInstall: () => Promise<boolean>
}

const INSTALL_STORAGE_KEY = "ivoiredu:pwa-installed"

// Navigateurs Android qui n'installent pas de PWA : navigateurs in-app (webviews
// des réseaux sociaux) et Firefox. Sur ceux-ci, on oriente vers Chrome.
const detectUnsupportedBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent.toLowerCase()
  const isAndroid = /android/.test(ua)
  if (!isAndroid) return false
  const inApp = /\b(fban|fbav|instagram|line|wv|; wv\)|micromessenger|whatsapp)\b/.test(ua)
  const isFirefox = /firefox|fxios/.test(ua)
  return inApp || isFirefox
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
  const locallyInstalled = window.localStorage.getItem(INSTALL_STORAGE_KEY) === "true"
  const standaloneDisplay =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  // iOS Safari expose navigator.standalone
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return locallyInstalled || standaloneDisplay || iosStandalone
}

export const useInstallPrompt = (): UseInstallPromptResult => {
  const [isInstalled, setIsInstalled] = useState(detectStandalone)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform] = useState(detectPlatform)
  const [isUnsupportedBrowser] = useState(detectUnsupportedBrowser)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Empêche la mini-infobar Chrome par défaut ; on pilote notre propre UI.
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      window.localStorage.setItem(INSTALL_STORAGE_KEY, "true")
      setIsInstalled(true)
      setDeferredPrompt(null)
    }
    const standaloneQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null
    const onDisplayModeChange = () => {
      if (detectStandalone()) {
        setIsInstalled(true)
      }
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    standaloneQuery?.addEventListener("change", onDisplayModeChange)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
      standaloneQuery?.removeEventListener("change", onDisplayModeChange)
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
    isUnsupportedBrowser,
    promptInstall,
  }
}
