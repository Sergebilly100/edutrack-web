/**
 * rollCall.store.ts
 *
 * Persiste l'état d'avancement du workflow de pointage prof pour chaque créneau.
 *
 * États possibles par créneau (scheduleId:date) :
 *
 *   "rollcall_pending"  → prof a fait étape 1 + 2 ET choisi "appel plus tard"
 *                         CourseCard → bouton "Faire le pointage des élèves" (amber)
 *
 *   "checkin_qr_done"   → prof a fait étape 1 + 2 ET fermé le sheet SANS choisir
 *                         (fermeture accidentelle, swipe, bouton X)
 *                         CourseCard → bouton "Poursuivre le pointage" (outline)
 *
 *   "ready_to_finish"   → appel élèves validé, cours à clôturer par scan QR de fin
 *                         CourseCard → bouton "Terminer le cours"
 *
 *   absent (clé inexistante ou supprimée) → workflow non commencé ou terminé
 */
import { create } from "zustand"
import { persist } from "zustand/middleware"

export type FlowState = "rollcall_pending" | "checkin_qr_done" | "ready_to_finish"

type FlowKey = string // `${scheduleId}:${date}`

interface RollCallStore {
  flows: Record<FlowKey, FlowState>

  /** Étapes 1+2 faites, prof a explicitement choisi "appel plus tard" */
  markRollCallPending: (scheduleId: string, date: string) => void

  /** Étapes 1+2 faites, sheet fermé sans terminer (fermeture accidentelle) */
  markCheckinQrDone: (scheduleId: string, date: string) => void

  /** Appel élèves validé, en attente du scan QR de fin */
  markReadyToFinish: (scheduleId: string, date: string) => void

  /** Appel soumis ou workflow complet → nettoyer */
  markDone: (scheduleId: string, date: string) => void

  getFlowState: (scheduleId: string, date: string) => FlowState | null

  /** Raccourcis lisibles */
  isRollCallPending: (scheduleId: string, date: string) => boolean
  isCheckinQrDone: (scheduleId: string, date: string) => boolean
  hasActiveFlow: (scheduleId: string, date: string) => boolean
}

export const useRollCallStore = create<RollCallStore>()(
  persist(
    (set, get) => ({
      flows: {},

      markRollCallPending: (scheduleId, date) =>
        set((s) => ({
          flows: { ...s.flows, [`${scheduleId}:${date}`]: "rollcall_pending" },
        })),

      markCheckinQrDone: (scheduleId, date) =>
        set((s) => ({
          flows: { ...s.flows, [`${scheduleId}:${date}`]: "checkin_qr_done" },
        })),

      markReadyToFinish: (scheduleId, date) =>
        set((s) => ({
          flows: { ...s.flows, [`${scheduleId}:${date}`]: "ready_to_finish" },
        })),

      markDone: (scheduleId, date) =>
        set((s) => {
          const next = { ...s.flows }
          delete next[`${scheduleId}:${date}`]
          return { flows: next }
        }),

      getFlowState: (scheduleId, date) =>
        get().flows[`${scheduleId}:${date}`] ?? null,

      isRollCallPending: (scheduleId, date) =>
        get().flows[`${scheduleId}:${date}`] === "rollcall_pending",

      isCheckinQrDone: (scheduleId, date) =>
        get().flows[`${scheduleId}:${date}`] === "checkin_qr_done",

      hasActiveFlow: (scheduleId, date) =>
        get().flows[`${scheduleId}:${date}`] != null,
    }),
    {
      name: "edutrack-roll-call-v2",
    }
  )
)
