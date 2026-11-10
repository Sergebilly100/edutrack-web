import { useCallback, useEffect, useRef, useState } from "react"

import { useAideStore } from "@/shared/aide/aide.store"

export type TourId =
  | "dashboard"
  | "validations"
  | "teachers"
  | "teacher-detail"
  | "students"
  | "student-detail"
  | "enrollments"
  | "enrollment-new"
  | "teacher-notes"
  | "teacher-calculation"
  | "evaluations"
  | "report-cards"
  | "end-of-year"
  | "school-years"
  | "finance-dashboard"
  | "finance-recovery"
  | "finance-entry"
  | "finance-history"
  | "finance-journal"
  | "finance-agreements"
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

const hasOpenDialog = () =>
  typeof document !== "undefined" &&
  Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'))

/** Rend le focus au bouton « Aide » à la fin d'une visite. */
const focusAideButton = () => {
  if (typeof document === "undefined") return
  document.querySelector<HTMLElement>("[data-aide-button]")?.focus()
}

/**
 * Visite guidée d'une page. Elle ne démarre JAMAIS seule : uniquement sur demande
 * (bouton « Aide » → « Visite guidée de la page », ou `start()`).
 * Tant que la page est montée et `enabled`, la visite est annoncée au bouton « Aide ».
 */
export function useTourGuide(tourId: TourId, enabled: boolean) {
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const registerTour = useAideStore((state) => state.registerTour)
  const unregisterTour = useAideStore((state) => state.unregisterTour)
  const tourRequest = useAideStore((state) => state.tourRequest)
  const clearTourRequest = useAideStore((state) => state.clearTourRequest)

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => {
    if (!enabled) return
    registerTour(tourId)
    return () => unregisterTour(tourId)
  }, [enabled, registerTour, tourId, unregisterTour])

  const stop = useCallback(() => {
    clearTimer()
    setRun(false)
  }, [clearTimer])

  const markDone = useCallback(() => {
    stop()
    setStepIndex(0)
    focusAideButton()
  }, [stop])

  const start = useCallback(
    (delayMs = 300) => {
      clearTimer()
      if (!enabled) return
      setStepIndex(0)
      // Délai : laisser le panneau d'aide se fermer et le DOM se stabiliser.
      timer.current = setTimeout(() => {
        timer.current = null
        if (!hasOpenDialog()) setRun(true)
      }, delayMs)
    },
    [clearTimer, enabled]
  )

  // Demande venant du panneau d'aide.
  useEffect(() => {
    if (!tourRequest || tourRequest.id !== tourId) return
    clearTourRequest()
    start()
  }, [clearTourRequest, start, tourId, tourRequest])

  // Un dialogue qui s'ouvre pendant la visite l'interrompt (sans rien mémoriser).
  useEffect(() => {
    if (typeof document === "undefined") return
    const observer = new MutationObserver(() => {
      if (!hasOpenDialog()) return
      clearTimer()
      setRun(false)
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] })
    return () => observer.disconnect()
  }, [clearTimer])

  useEffect(() => clearTimer, [clearTimer])

  return { run, setRun, stepIndex, setStepIndex, markDone, start, restart: start }
}
