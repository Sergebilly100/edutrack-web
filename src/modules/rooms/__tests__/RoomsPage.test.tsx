import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

const listRoomsMock = vi.fn()

vi.mock("@/modules/rooms/rooms.api", () => ({
  listRooms: () => listRoomsMock(),
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
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
})
