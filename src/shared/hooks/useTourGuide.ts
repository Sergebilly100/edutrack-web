import { useCallback, useEffect, useState } from "react"

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

  useEffect(() => {
    if (!enabled) return
    const done = localStorage.getItem(key) === "1"
    if (!done) {
      // Légère temporisation pour laisser le DOM se stabiliser
      const t = setTimeout(() => setRun(true), 800)
      return () => clearTimeout(t)
    }
  }, [enabled, key])

  const markDone = useCallback(() => {
    localStorage.setItem(key, "1")
    setRun(false)
  }, [key])

  const restart = useCallback((delayMs = 300) => {
    localStorage.removeItem(key)
    setStepIndex(0)
    // Délai pour laisser le DOM se stabiliser (lazy tabs, scroll to top)
    setTimeout(() => setRun(true), delayMs)
  }, [key])

  return { run, setRun, stepIndex, setStepIndex, markDone, restart }
}
