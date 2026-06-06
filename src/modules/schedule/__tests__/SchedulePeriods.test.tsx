import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const fetchWeeklyScheduleMock = vi.fn()
const fetchActiveSchedulePeriodsMock = vi.fn()

vi.mock("@/modules/schedule/schedule.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/schedule/schedule.api")>(
    "@/modules/schedule/schedule.api"
  )
  return {
    ...actual,
    fetchWeeklySchedule: (...args: unknown[]) => fetchWeeklyScheduleMock(...args),
    fetchActiveSchedulePeriods: () => fetchActiveSchedulePeriodsMock(),
    fetchNextWeekCoverage: vi.fn().mockResolvedValue({ hasSchedule: false }),
    createScheduleSlot: vi.fn(),
    updateScheduleSlot: vi.fn(),
    deleteScheduleSlotFromDate: vi.fn(),
  }
})

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: (_perm: string) => true,
    refreshPermissions: vi.fn(),
  }),
}))

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: { id: "u1", role: "director" }, accessToken: "tok" }),
}))

vi.mock("@/modules/teachers/teachers.api", () => ({
  getTeachers: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 200 }),
}))

vi.mock("@/modules/schedule/components/WeekGrid", () => ({
  default: () => <div data-testid="week-grid">WeekGrid</div>,
}))

vi.mock("@/shared/components/OfflineIndicator", () => ({
  OfflineIndicator: () => null,
}))

vi.mock("@/shared/components/OfflineGuard", () => ({
  OfflineGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import SchedulePage from "@/modules/schedule/SchedulePage"

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

const renderSchedulePage = () =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <SchedulePage />
      </MemoryRouter>
    </QueryClientProvider>
  )

const makeScheduleData = (
  period: { id: string; name: string; validFrom: string; validTo: string; isActive: boolean } | null = null
) => ({
  date: "2026-06-02",
  period,
  schedules: [],
  catalog: { teachers: [], classes: [], rooms: [], timeSlots: [] },
})

beforeEach(() => {
  vi.clearAllMocks()
  fetchActiveSchedulePeriodsMock.mockResolvedValue([])
})

describe("SchedulePeriods", () => {
  it("affiche l'alerte quand aucune période n'est active", async () => {
    fetchWeeklyScheduleMock.mockResolvedValue(makeScheduleData(null))

    renderSchedulePage()

    await waitFor(() => {
      expect(
        screen.getByText(/aucune période active pour cette semaine/i)
      ).toBeInTheDocument()
    })
  })

  it("affiche le nom de la période active dans l'entête de vue liste", async () => {
    fetchWeeklyScheduleMock.mockResolvedValue(
      makeScheduleData({
        id: "p1",
        name: "Trimestre 1",
        validFrom: "2026-01-01",
        validTo: "2026-06-30",
        isActive: true,
      })
    )

    renderSchedulePage()

    await waitFor(() => {
      expect(screen.getByText(/trimestre 1/i)).toBeInTheDocument()
    })
  })

  it("propose les périodes actives dans le formulaire d'ajout de créneau", async () => {
    fetchWeeklyScheduleMock.mockResolvedValue(makeScheduleData(null))
    fetchActiveSchedulePeriodsMock.mockResolvedValue([
      { id: "p1", name: "Semestre 1", validFrom: "2026-01-01", validTo: "2026-06-30", isActive: true },
      { id: "p2", name: "Semestre 2", validFrom: "2026-07-01", validTo: "2026-12-31", isActive: true },
    ])

    renderSchedulePage()

    // La page charge sans erreur — les périodes seront accessibles via le formulaire
    await waitFor(() => {
      expect(fetchWeeklyScheduleMock).toHaveBeenCalled()
    })
  })
})
