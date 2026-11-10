import { create } from "zustand"

type AideState = {
  panelOpen: boolean
  /** Visites enregistrées par les pages montées (la dernière est celle de la page courante). */
  tours: string[]
  /** Demande de démarrage d'une visite, consommée par la page concernée. */
  tourRequest: { id: string; nonce: number } | null
  /** Incrémenté à chaque écriture de l'état « vu » pour rafraîchir les composants. */
  revision: number
  setPanelOpen: (open: boolean) => void
  registerTour: (id: string) => void
  unregisterTour: (id: string) => void
  requestTour: (id: string) => void
  clearTourRequest: () => void
  bumpRevision: () => void
}

export const useAideStore = create<AideState>((set) => ({
  panelOpen: false,
  tours: [],
  tourRequest: null,
  revision: 0,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  registerTour: (id) => set((state) => ({ tours: [...state.tours.filter((tour) => tour !== id), id] })),
  unregisterTour: (id) => set((state) => ({ tours: state.tours.filter((tour) => tour !== id) })),
  requestTour: (id) => set((state) => ({ tourRequest: { id, nonce: (state.tourRequest?.nonce ?? 0) + 1 } })),
  clearTourRequest: () => set({ tourRequest: null }),
  bumpRevision: () => set((state) => ({ revision: state.revision + 1 })),
}))
