import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

const listRoomsMock = vi.fn()
const updateRoomMock = vi.fn()

vi.mock("@/modules/rooms/rooms.api", () => ({
  listRooms: () => listRoomsMock(),
  createRoom: vi.fn(),
  updateRoom: (roomId: string, payload: unknown) => updateRoomMock(roomId, payload),
  deleteRoom: vi.fn(),
  getRoomQr: vi.fn(),
  regenerateRoomQr: vi.fn(),
}))

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: (_perm: string) => true,
    refreshPermissions: vi.fn(),
  }),
}))

vi.mock("@/shared/components/QRCodeGenerator", () => ({
  QRCodeGenerator: ({ roomName }: { roomName: string }) => (
    <div data-testid="qr-generator">{roomName}</div>
  ),
}))

vi.mock("@/shared/components/OfflineGuard", () => ({
  OfflineGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/shared/components/OfflineIndicator", () => ({
  OfflineIndicator: () => null,
}))

import RoomsPage from "@/modules/rooms/RoomsPage"
import type { RoomListItem } from "@/modules/rooms/rooms.api"

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

const renderRoomsPage = () =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <RoomsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )

const makeRoom = (overrides: Partial<RoomListItem> = {}): RoomListItem => ({
  id: "room-1",
  name: "Salle A",
  building: "Bâtiment Principal",
  capacity: 30,
  latitude: null,
  longitude: null,
  geoRadius: 100,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  stats: { weeklySchedulesCount: 3, scansCount: 12 },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("RoomsPage", () => {
  it("affiche le skeleton de chargement puis les données", async () => {
    listRoomsMock.mockResolvedValueOnce(new Promise(() => {}))

    renderRoomsPage()

    expect(screen.getByText(/chargement des salles/i)).toBeInTheDocument()
  })

  it("affiche l'état vide si aucune salle", async () => {
    listRoomsMock.mockResolvedValueOnce([])

    renderRoomsPage()

    await waitFor(() => {
      expect(screen.getByText(/aucune salle active trouvée/i)).toBeInTheDocument()
    })
  })

  it("affiche la liste des salles avec noms et bâtiments", async () => {
    listRoomsMock.mockResolvedValueOnce([
      makeRoom({ id: "r1", name: "Salle 101", building: "Annexe" }),
      makeRoom({ id: "r2", name: "Salle 202", building: null }),
    ])

    renderRoomsPage()

    await waitFor(() => {
      expect(screen.getByText("Salle 101")).toBeInTheDocument()
      expect(screen.getByText("Salle 202")).toBeInTheDocument()
    })
  })

  it("met à jour le badge GPS immédiatement après ajout de coordonnées", async () => {
    // Salle sans GPS au départ
    listRoomsMock.mockResolvedValue([
      makeRoom({ id: "r1", name: "Salle GPS", latitude: null, longitude: null }),
    ])

    // updateRoom retourne la salle avec les nouvelles coordonnées
    updateRoomMock.mockResolvedValue(
      makeRoom({ id: "r1", name: "Salle GPS", latitude: 5.345, longitude: -4.012, geoRadius: 100 })
    )

    renderRoomsPage()

    // Attendre l'affichage initial : GPS non configuré
    await waitFor(() => {
      expect(screen.getByText("Salle GPS")).toBeInTheDocument()
    })
    expect(screen.getByText(/GPS non configuré/i)).toBeInTheDocument()

    // Ouvrir le dialog d'édition
    fireEvent.click(screen.getByRole("button", { name: /Modifier/i }))

    // Remplir les coordonnées GPS
    const latInput = await screen.findByPlaceholderText(/Latitude GPS/i)
    const lonInput = screen.getByPlaceholderText(/Longitude GPS/i)
    fireEvent.change(latInput, { target: { value: "5.345" } })
    fireEvent.change(lonInput, { target: { value: "-4.012" } })

    // Sauvegarder → ouvre le dialog de confirmation
    fireEvent.click(screen.getByRole("button", { name: /Sauvegarder/i }))

    // Confirmer
    const confirmButton = await screen.findByRole("button", { name: /Confirmer/i })
    fireEvent.click(confirmButton)

    // updateRoom doit avoir été appelé avec les bonnes coordonnées
    await waitFor(() => {
      expect(updateRoomMock).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({ latitude: 5.345, longitude: -4.012 })
      )
    })

    // Le badge doit passer à "GPS configuré" IMMÉDIATEMENT (sans attendre un refetch)
    await waitFor(() => {
      expect(screen.getByText(/GPS configuré/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/GPS non configuré/i)).not.toBeInTheDocument()
  })
})
