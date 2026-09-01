import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { navigateMock, scheduleMock, contextMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  scheduleMock: vi.fn(),
  contextMock: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock("@/modules/schedule/schedule.api", () => ({
  fetchTeacherSchedule: () => scheduleMock(),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  fetchTeacherAcademicContext: () => contextMock(),
}))

vi.mock("@/shared/api/client", () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: [] }) },
}))

import TeacherDashboardPage from "@/modules/dashboard/TeacherDashboardPage"
import { useAuthStore } from "@/shared/store/auth.store"

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<MemoryRouter><QueryClientProvider client={client}>{ui}</QueryClientProvider></MemoryRouter>)
}

describe("TeacherDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: {
        id: "teacher-1", name: "Mariam Coulibaly", role: "teacher", phone: null, email: "mariam@example.com",
        profilePhotoUrl: null, mustChangePassword: false, tenantId: "tenant-1", schemaName: "school_sainte_marie", plan: "standard",
      },
      permissions: [], accessToken: null,
    })
    scheduleMock.mockResolvedValue([{
      id: "slot-1", class_id: "class-1", class_name: "6ème A", subject_name: "Mathématiques", room_id: "room-1", room_name: "A1",
      start_at: "2099-01-01T08:00:00.000Z", end_at: "2099-01-01T09:00:00.000Z",
    }])
    contextMock.mockResolvedValue({
      classes: [{ id: "class-1", name: "6ème A", levelId: "level-1", levelName: "6ème", schoolYearId: "year-1", schoolYearLabel: "2098-2099" }],
      gradingPeriods: [{ id: "period-1", schoolYearId: "year-1", label: "1er trimestre", startDate: "2098-09-01", endDate: "2098-12-20", isCompleted: false, isCurrent: true }],
    })
  })

  it("donne accès au cours du jour et aux notes de la classe attribuée", async () => {
    renderWithClient(<TeacherDashboardPage />)

    expect(await screen.findByText("Bonjour, Mariam")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Revoir le guide" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mes notifications" })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole("button", { name: "Saisir les notes" }))
    expect(navigateMock).toHaveBeenCalledWith("/academic/notes?classId=class-1&gradingPeriodId=period-1")
    fireEvent.click(screen.getAllByRole("button", { name: /6ème A/ })[1])
    expect(navigateMock).toHaveBeenCalledWith("/academic/notes?classId=class-1&gradingPeriodId=period-1")
  })
})
