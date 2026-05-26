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

/**
 * Contexte du scan de début mémorisé localement pour ce créneau.
 * Sert à valider le scan de fin **hors ligne** : sans ce contexte, un QR
 * différent serait silencieusement mis en queue alors que le backend l'aurait
 * refusé (validation start↔end côté serveur). On stocke le token brut (utile
 * pour comparer exactement les chaînes) et le room_id résolu (utile pour les
 * messages d'erreur et pour le scénario "saut QR" où il n'y a pas de token).
 */
export type StartScanContext = {
  /** Token QR scanné en début (ou null si l'étape a été sautée via skipQr) */
  qrToken: string | null
  /** room_id résolu via IndexedDB ou cache React Query, null si saut QR */
  roomId: string | null
  /** Timestamp du scan début — utile pour debug + tri */
  scannedAt: number
}

interface RollCallStore {
  flows: Record<FlowKey, FlowState>
  /** Contexte du scan début par créneau (utilisé pour valider le scan fin offline) */
  startScans: Record<FlowKey, StartScanContext>

  /** Étapes 1+2 faites, prof a explicitement choisi "appel plus tard" */
  markRollCallPending: (scheduleId: string, date: string) => void

  /** Étapes 1+2 faites, sheet fermé sans terminer (fermeture accidentelle) */
  markCheckinQrDone: (scheduleId: string, date: string) => void

  /** Appel élèves validé, en attente du scan QR de fin */
  markReadyToFinish: (scheduleId: string, date: string) => void

  /** Appel soumis ou workflow complet → nettoyer */
  markDone: (scheduleId: string, date: string) => void

  /** Enregistre le contexte du scan début (token + roomId). null pour skipQr. */
  setStartScanContext: (
    scheduleId: string,
    date: string,
    context: StartScanContext
  ) => void

  getFlowState: (scheduleId: string, date: string) => FlowState | null
  getStartScanContext: (scheduleId: string, date: string) => StartScanContext | null

  /** Raccourcis lisibles */
  isRollCallPending: (scheduleId: string, date: string) => boolean
  isCheckinQrDone: (scheduleId: string, date: string) => boolean
  hasActiveFlow: (scheduleId: string, date: string) => boolean
}

export const useRollCallStore = create<RollCallStore>()(
  persist(
    (set, get) => ({
      flows: {},
      startScans: {},

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

      // Nettoie aussi le contexte du scan début : le cours est terminé, le
      // token QR n'a plus à rester en mémoire (RGPD + éviter les conflits
      // si le même créneau est rejoué le lendemain).
      markDone: (scheduleId, date) =>
        set((s) => {
          const flowKey = `${scheduleId}:${date}`
          const nextFlows = { ...s.flows }
          const nextScans = { ...s.startScans }
          delete nextFlows[flowKey]
          delete nextScans[flowKey]
          return { flows: nextFlows, startScans: nextScans }
        }),

      setStartScanContext: (scheduleId, date, context) =>
        set((s) => ({
          startScans: { ...s.startScans, [`${scheduleId}:${date}`]: context },
        })),

      getFlowState: (scheduleId, date) =>
        get().flows[`${scheduleId}:${date}`] ?? null,

      getStartScanContext: (scheduleId, date) =>
        get().startScans[`${scheduleId}:${date}`] ?? null,

      isRollCallPending: (scheduleId, date) =>
        get().flows[`${scheduleId}:${date}`] === "rollcall_pending",

      isCheckinQrDone: (scheduleId, date) =>
        get().flows[`${scheduleId}:${date}`] === "checkin_qr_done",

      hasActiveFlow: (scheduleId, date) =>
        get().flows[`${scheduleId}:${date}`] != null,
    }),
    {
      // v3 ajoute `startScans` pour la validation offline du QR de fin.
      // L'ancien storage v2 sans cette clé reste compatible (lecture safe).
      name: "edutrack-roll-call-v3",
    }
  )
)
