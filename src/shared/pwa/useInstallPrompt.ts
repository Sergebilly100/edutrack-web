import { useEffect, useLayoutEffect, useState } from "react"

import { setPwaManifest, type PwaInstallAudience } from "./manifest"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export type InstallPlatform = "android" | "ios" | "desktop" | "other"
export type InstallBrowser = "chrome" | "safari" | "firefox" | "edge" | "in_app" | "other"

export type UseInstallPromptResult = {
  /** L'app tourne déjà en mode installé (standalone) → pas besoin de proposer. */
  isInstalled: boolean
  /** Un prompt natif d'installation est disponible (Chrome/Android/Desktop). */
  canPromptInstall: boolean
  platform: InstallPlatform
  browser: InstallBrowser
  /**
   * Navigateur qui ne sait pas installer une PWA (navigateur in-app type
   * Facebook/WhatsApp, ou Firefox Android) → il faut conseiller d'ouvrir dans Chrome.
   */
  isUnsupportedBrowser: boolean
  /** Déclenche le prompt natif. Retourne true si l'utilisateur a accepté. */
  promptInstall: () => Promise<boolean>
}

const getInstallStorageKey = (audience: PwaInstallAudience): string =>
  `ivoiredu:pwa-installed:${audience}`

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

const detectBrowser = (): InstallBrowser => {
  if (typeof navigator === "undefined") return "other"
  const ua = navigator.userAgent.toLowerCase()
  const vendor = navigator.vendor.toLowerCase()
  const isInApp = /\b(fban|fbav|instagram|line|wv|; wv\)|micromessenger|whatsapp)\b/.test(ua)
  if (isInApp) return "in_app"
  if (/edg\//.test(ua)) return "edge"
  if (/firefox|fxios/.test(ua)) return "firefox"
  if (/crios|chrome|chromium/.test(ua) && !/edg\//.test(ua)) return "chrome"
  if (/safari/.test(ua) && /apple/.test(vendor) && !/crios|fxios|edg\//.test(ua)) return "safari"
  return "other"
}

const detectPlatform = (): InstallPlatform => {
  if (typeof navigator === "undefined") return "other"
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return "ios"
  if (/android/.test(ua)) return "android"
  if (/windows|macintosh|linux/.test(ua)) return "desktop"
  return "other"
}

const detectStandalone = (audience: PwaInstallAudience): boolean => {
  if (typeof window === "undefined") return false
  const locallyInstalled = window.localStorage.getItem(getInstallStorageKey(audience)) === "true"
  const standaloneDisplay =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  // iOS Safari expose navigator.standalone
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return locallyInstalled || standaloneDisplay || iosStandalone
}

export const useInstallPrompt = (audience: PwaInstallAudience): UseInstallPromptResult => {
  const [isInstalled, setIsInstalled] = useState(() => detectStandalone(audience))
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform] = useState(detectPlatform)
  const [browser] = useState(detectBrowser)
  const [isUnsupportedBrowser] = useState(detectUnsupportedBrowser)

  useLayoutEffect(() => {
    setPwaManifest(audience)
  }, [audience])

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Empêche la mini-infobar Chrome par défaut ; on pilote notre propre UI.
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      window.localStorage.setItem(getInstallStorageKey(audience), "true")
      setIsInstalled(true)
      setDeferredPrompt(null)
    }
    const standaloneQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null
    const onDisplayModeChange = () => {
      if (detectStandalone(audience)) {
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
    setPwaManifest(audience)
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (choice.outcome === "accepted") {
      window.localStorage.setItem(getInstallStorageKey(audience), "true")
      setIsInstalled(true)
    }
    return choice.outcome === "accepted"
  }

  return {
    isInstalled,
    canPromptInstall: Boolean(deferredPrompt),
    platform,
    browser,
    isUnsupportedBrowser,
    promptInstall,
  }
}
