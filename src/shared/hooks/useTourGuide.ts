import { useCallback, useEffect, useRef, useState } from "react"

const TOUR_KEY_PREFIX = "ivoiredu-tour-done-"

export type TourId =
  | "dashboard"
  | "validations"
  | "teachers"
  | "teacher-detail"
  | "students"
  | "student-detail"
  | "schedule"
  | "salaries"
  | "subscriptions"
  | "subscription-revenue"
  | "settings"
  | "rooms"
  | "import"
  | "teacher-app"
  | "teacher-dashboard"
  | "parent-portal"

export function useTourGuide(tourId: TourId, enabled: boolean) {
  const key = `${TOUR_KEY_PREFIX}${tourId}`
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const autoStartTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasOpenDialog = useCallback(
    () => typeof document !== "undefined" && Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')),
    []
  )

  useEffect(() => {
    if (!enabled || hasOpenDialog()) return
    const done = localStorage.getItem(key) === "1"
    if (!done) {
      // Légère temporisation pour laisser le DOM se stabiliser
      autoStartTimer.current = setTimeout(() => {
        autoStartTimer.current = null
        if (!hasOpenDialog()) setRun(true)
      }, 800)
      return () => {
        if (autoStartTimer.current) clearTimeout(autoStartTimer.current)
      }
    }
  }, [enabled, hasOpenDialog, key])

  useEffect(() => {
    if (typeof document === "undefined") return
    const observer = new MutationObserver(() => {
      if (!hasOpenDialog()) return
      if (autoStartTimer.current) clearTimeout(autoStartTimer.current)
      setRun(false)
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] })
    return () => observer.disconnect()
  }, [hasOpenDialog])

  const markDone = useCallback(() => {
    if (autoStartTimer.current) clearTimeout(autoStartTimer.current)
    localStorage.setItem(key, "1")
    setRun(false)
  }, [key])

  const restart = useCallback((delayMs = 300) => {
    if (autoStartTimer.current) clearTimeout(autoStartTimer.current)
    if (!enabled || hasOpenDialog()) return
    localStorage.removeItem(key)
    setStepIndex(0)
    // Délai pour laisser le DOM se stabiliser (lazy tabs, scroll to top)
    autoStartTimer.current = setTimeout(() => {
      autoStartTimer.current = null
      if (!hasOpenDialog()) setRun(true)
    }, delayMs)
  }, [enabled, hasOpenDialog, key])

  useEffect(() => () => {
    if (autoStartTimer.current) clearTimeout(autoStartTimer.current)
  }, [])

  return { run, setRun, stepIndex, setStepIndex, markDone, restart }
}
