import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { listSchoolYearsMock, createSchoolYearMock } = vi.hoisted(() => ({
  listSchoolYearsMock: vi.fn(),
  createSchoolYearMock: vi.fn(),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: () => listSchoolYearsMock(),
  createSchoolYear: (payload: unknown) => createSchoolYearMock(payload),
  updateSchoolYear: vi.fn(),
}))

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: () => true, refreshPermissions: vi.fn() }),
}))

vi.mock("@/shared/components/OfflineIndicator", () => ({ OfflineIndicator: () => null }))

import SchoolYearsPage from "@/modules/academic/SchoolYearsPage"

const activeYear = {
  id: "year-1",
  label: "09/2026 - 06/2027",
  startDate: "2026-09-01",
  endDate: "2027-06-30",
  status: "active" as const,
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
}

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={["/academic/school-years"]}><SchoolYearsPage /></MemoryRouter>
  </QueryClientProvider>
)

describe("SchoolYearsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSchoolYearsMock.mockResolvedValue([activeYear])
    createSchoolYearMock.mockResolvedValue({ ...activeYear, id: "year-2", status: "draft" })
  })

  it("met clairement en avant l’année active", async () => {
    renderPage()
    expect(await screen.findByText("Année en cours")).toBeInTheDocument()
    expect(screen.getAllByText("09/2026 - 06/2027").length).toBeGreaterThan(0)
  })

  it("crée une année scolaire avec les valeurs validées", async () => {
    renderPage()
    await screen.findByText("Année en cours")
    fireEvent.click(screen.getByRole("button", { name: /ajouter une année/i }))
    fireEvent.change(screen.getByLabelText("Libellé"), { target: { value: "09/2027 - 06/2028" } })
    fireEvent.change(screen.getByLabelText("Date de début"), { target: { value: "2027-09-01" } })
    fireEvent.change(screen.getByLabelText("Date de fin"), { target: { value: "2028-06-30" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => expect(createSchoolYearMock).toHaveBeenCalledWith({
      label: "09/2027 - 06/2028",
      startDate: "2027-09-01",
      endDate: "2028-06-30",
      status: "draft",
    }))
  })
})
