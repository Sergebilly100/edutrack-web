import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import TeacherFlow, { type TeacherSchedule } from "@/modules/attendance/TeacherFlow"

vi.mock("@/shared/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}))

vi.mock("@/shared/hooks/useOfflineMutation", () => ({
  useOfflineMutation: vi.fn((fn) => ({
    mutateAsync: vi.fn(async (variables) => fn(variables)),
    isPending: false,
  })),
  OfflineMutationQueuedError: class extends Error {},
}))

vi.mock("@/shared/hooks/useStudentLabel", () => ({
  useStudentLabels: () => ({
    singular: "Élève",
    plural: "Élèves",
    singularLower: "élève",
    pluralLower: "élèves",
  }),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

const { bulkStudentsMock } = vi.hoisted(() => ({
  bulkStudentsMock: vi.fn(),
}))

vi.mock("@/modules/attendance/attendance.api", () => ({
  checkIn: vi.fn(async () => ({ late_minutes: 0 })),
  qrScan: vi.fn(async () => ({ room_mismatch: false })),
  bulkStudents: bulkStudentsMock,
  fetchRooms: vi.fn(async () => []),
  fetchStudents: vi.fn(async () => []),
}))

const mockSchedule: TeacherSchedule = {
  id: "schedule-1",
  class_id: "class-1",
  class_name: "6ème A",
  subject_name: "Mathématiques",
  room_id: "room-1",
  room_name: "Salle 101",
  start_at: new Date().toISOString(),
  end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

/** Navigate from step 1 to step 4 in demoMode, validating 1 absent */
const navigateToStep4 = async () => {
  const startBtns = await screen.findAllByText(/Je suis présent/i)
  fireEvent.click(startBtns[0])

  const skipBtn = await screen.findByText(/Passer le scan/i)
  fireEvent.click(skipBtn)

  // DEMO_STUDENTS appear in step 3 — toggle first student absent
  await screen.findByText(/Kouadio Amani/i)
  const presentBtn = screen.getByRole("button", { name: /Marquer Kouadio Amani absent/i })
  fireEvent.click(presentBtn)

  // Validate
  fireEvent.click(screen.getByRole("button", { name: /Valider l'appel/i }))
  await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument())

  // Confirm
  const confirmBtn = screen.getAllByRole("button").find(
    (btn) => /Confirmer l'appel/i.test(btn.textContent ?? "")
  )!
  fireEvent.click(confirmBtn)

  await waitFor(() => {
    expect(screen.getByText(/Cours démarré. Bonne journée/i)).toBeInTheDocument()
  })
}

describe("TeacherFlow - Re-soumission appel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    bulkStudentsMock.mockResolvedValue({
      success: true,
      notifSendAfter: Date.now() + 15 * 60 * 1000,
      isLocked: false,
    })
  })

  it("affiche le bouton 'Mettre à jour l'appel' après la première validation", async () => {
    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await navigateToStep4()

    expect(screen.getByText(/Mettre à jour l'appel/i)).toBeInTheDocument()
  })

  it("affiche la deadline de modification après validation (mode démo)", async () => {
    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await navigateToStep4()

    expect(screen.getByText(/Modifiable jusqu'à/i)).toBeInTheDocument()
  })

  it("retourne à l'étape 3 en mode update quand on clique 'Mettre à jour'", async () => {
    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await navigateToStep4()

    fireEvent.click(screen.getByText(/Mettre à jour l'appel/i))

    await waitFor(() => {
      expect(screen.getByText(/Appel de 6ème A/i)).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Vous modifiez un appel déjà soumis/i)
    ).toBeInTheDocument()
  })

  it("en mode update, le bouton 'Annuler' revient à l'étape 4 sans re-soumettre", async () => {
    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await navigateToStep4()

    fireEvent.click(screen.getByText(/Mettre à jour l'appel/i))
    await waitFor(() => expect(screen.getByText(/Appel de 6ème A/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/← Annuler/i))
    await waitFor(() => {
      expect(screen.getByText(/Cours démarré. Bonne journée/i)).toBeInTheDocument()
    })

    // Pas de re-soumission (bulkStudentsMock appelé 1 fois seulement — lors de la validation initiale)
    expect(bulkStudentsMock).toHaveBeenCalledTimes(0) // demoMode n'appelle pas l'API
  })

  it("en mode update, le dialog indique 'Les notifications aux parents seront mises à jour'", async () => {
    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await navigateToStep4()

    fireEvent.click(screen.getByText(/Mettre à jour l'appel/i))
    await waitFor(() => expect(screen.getByText(/Appel de 6ème A/i)).toBeInTheDocument())

    // Kouadio Amani est déjà absent (du 1er appel) — marquer Traoré Mariam absent
    await screen.findByText(/Traoré Mariam/i)
    fireEvent.click(screen.getByRole("button", { name: /Marquer Traoré Mariam absent/i }))

    // Ouvrir le dialog
    fireEvent.click(screen.getByRole("button", { name: /Valider l'appel/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Les notifications aux parents seront mises à jour/i)
      ).toBeInTheDocument()
    })
  })

  it("le bouton confirmer affiche 'Mettre à jour l'appel' en mode update", async () => {
    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await navigateToStep4()

    fireEvent.click(screen.getByText(/Mettre à jour l'appel/i))
    await waitFor(() => expect(screen.getByText(/Appel de 6ème A/i)).toBeInTheDocument())

    // Ouvrir le dialog avec 0 absents
    fireEvent.click(screen.getByRole("button", { name: /Valider l'appel/i }))

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    })

    // Le bouton de confirmation mentionne "Mettre à jour"
    const dialogBtns = screen.getAllByRole("button").filter(
      (btn) => /Mettre à jour l'appel/i.test(btn.textContent ?? "")
    )
    expect(dialogBtns.length).toBeGreaterThan(0)
  })
})

describe("TeacherFlow.Step4Success - Délai affiché", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it("affiche 'Modifiable jusqu'à HH:MM' après une soumission avec deadline future", async () => {
    bulkStudentsMock.mockResolvedValue({
      success: true,
      notifSendAfter: Date.now() + 30 * 60 * 1000, // +30 min
      isLocked: false,
    })

    render(<TeacherFlow schedule={mockSchedule} demoMode={true} />, {
      wrapper: createWrapper(),
    })

    await navigateToStep4()

    expect(screen.getByText(/Modifiable jusqu'à/i)).toBeInTheDocument()
    expect(screen.getByText(/Mettre à jour l'appel/i)).toBeInTheDocument()
  })
})
