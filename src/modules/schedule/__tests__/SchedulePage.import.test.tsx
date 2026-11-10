import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ permissions: new Set<string>(), weekly: vi.fn() }))

vi.mock("../schedule.api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchWeeklySchedule: mocks.weekly,
  fetchNextWeekCoverage: vi.fn(async () => true),
  fetchActiveSchedulePeriods: vi.fn(async () => []),
}))
vi.mock("@/modules/teachers/teachers.api", () => ({ getTeachers: vi.fn(async () => ({ data: [], pagination: { page: 1, limit: 200, total: 0, totalPages: 1 } })) }))
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (key: string) => mocks.permissions.has(key) }) }))
vi.mock("@/shared/hooks/useTourGuide", () => ({ useTourGuide: () => ({ run: false, stepIndex: 0, setStepIndex: vi.fn(), markDone: vi.fn(), restart: vi.fn() }) }))

import { useAuthStore } from "@/shared/store/auth.store"
import SchedulePage from "../SchedulePage"

const Where = () => { const location = useLocation(); return <p data-testid="where">{location.pathname}{location.search}</p> }

const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={["/schedule"]}>
      <Routes>
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/import" element={<Where />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
)

const week = (period: unknown) => ({
  date: "2026-11-09", period, schedules: [], catalog: { teachers: [], classes: [], subjects: [], levels: [], rooms: [], timeSlots: [] },
  schoolYear: { id: "y", label: "2026-2027", status: "active", startDate: "2026-09-01", endDate: "2027-07-01" },
})
const period = { id: "p", name: "Période", validFrom: "2026-09-01", validTo: "2027-07-01", isActive: true }
const IMPORT = "Importer l'EDT"

describe("emploi du temps : bouton d'import (point 15)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(), onchange: null }) })
    Element.prototype.scrollIntoView = vi.fn()
    mocks.weekly.mockResolvedValue(week(period))
    useAuthStore.setState({ user: { id: "director", role: "director", schemaName: "school_test", tenantId: "school-id" } as NonNullable<ReturnType<typeof useAuthStore.getState>["user"]> })
  })

  it("affiche le bouton pour qui détient import.schedule et redirige vers l'import de l'EDT", async () => {
    mocks.permissions = new Set(["schedule.view", "schedule.edit", "import.schedule"])
    mount()
    fireEvent.click(await screen.findByRole("button", { name: IMPORT }))
    expect(await screen.findByTestId("where")).toHaveTextContent("/import?type=schedule")
  })

  it("masque le bouton sans la permission d'import", async () => {
    mocks.permissions = new Set(["schedule.view", "schedule.edit"])
    mount()
    await screen.findByRole("button", { name: "Ajouter un créneau" })
    expect(screen.queryByRole("button", { name: IMPORT })).not.toBeInTheDocument()
  })

  it("garde « Ajouter un créneau » à côté de l'import quand une période est active", async () => {
    mocks.permissions = new Set(["schedule.view", "schedule.edit", "import.schedule"])
    mount()
    expect(await screen.findByRole("button", { name: IMPORT })).toHaveClass("border")
    expect(screen.getAllByRole("button", { name: "Ajouter un créneau" }).length).toBeGreaterThan(0)
  })

  it("sans période active, l'import devient l'action principale", async () => {
    mocks.weekly.mockResolvedValue(week(null))
    mocks.permissions = new Set(["schedule.view", "schedule.edit", "import.schedule"])
    mount()
    await screen.findByRole("button", { name: IMPORT })
    await waitFor(() => expect(screen.getByRole("button", { name: IMPORT }).className).toContain("bg-primary"))
    expect(screen.queryByRole("button", { name: "Ajouter un créneau" })).not.toBeInTheDocument()
  })
})
