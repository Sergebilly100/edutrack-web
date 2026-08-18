import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { listSchoolYearsMock, updateSchoolYearReviewDateMock } = vi.hoisted(() => ({
  listSchoolYearsMock: vi.fn(),
  updateSchoolYearReviewDateMock: vi.fn(),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: () => listSchoolYearsMock(),
  updateSchoolYearReviewDate: (id: string, payload: unknown) => updateSchoolYearReviewDateMock(id, payload),
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
  endOfYearReviewStartDate: "2027-05-31",
  status: "active" as const,
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
}

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={["/academic/school-years"]}><SchoolYearsPage /></MemoryRouter>
  </QueryClientProvider>,
)

describe("SchoolYearsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSchoolYearsMock.mockResolvedValue([activeYear])
    updateSchoolYearReviewDateMock.mockResolvedValue(activeYear)
  })

  it("met en avant l’année active sans action de création ou d’activation", async () => {
    renderPage()
    expect(await screen.findByText("Année en cours")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /ajouter une année/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Statut")).not.toBeInTheDocument()
  })

  it("modifie uniquement la date de début de revue", async () => {
    renderPage()
    const input = await screen.findByLabelText("Date de début de revue")
    fireEvent.change(input, { target: { value: "2027-05-15" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la date" }))

    await waitFor(() => expect(updateSchoolYearReviewDateMock).toHaveBeenCalledWith("year-1", {
      endOfYearReviewStartDate: "2027-05-15",
    }))
  })
})
