import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { listSchoolYearsMock, updateSchoolYearReviewDateMock, listGradingPeriodsMock, updateGradingPeriodMock, createGradingPeriodMock } = vi.hoisted(() => ({
  listSchoolYearsMock: vi.fn(),
  updateSchoolYearReviewDateMock: vi.fn(),
  listGradingPeriodsMock: vi.fn(),
  updateGradingPeriodMock: vi.fn(),
  createGradingPeriodMock: vi.fn(),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: () => listSchoolYearsMock(),
  updateSchoolYearReviewDate: (id: string, payload: unknown) => updateSchoolYearReviewDateMock(id, payload),
  listGradingPeriods: () => listGradingPeriodsMock(),
  updateGradingPeriod: (id: string, payload: unknown) => updateGradingPeriodMock(id, payload),
  createGradingPeriod: (payload: unknown) => createGradingPeriodMock(payload),
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
  gradingPeriodType: "trimester" as const,
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
    listGradingPeriodsMock.mockResolvedValue([])
  })

  it("met en avant l’année active sans action de création ou d’activation", async () => {
    renderPage()
    expect(await screen.findByText("Année en cours")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /ajouter une année/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Statut")).not.toBeInTheDocument()
  })

  it("modifie uniquement la date d’ouverture des décisions de fin d’année", async () => {
    renderPage()
    const input = await screen.findByLabelText(/Ouverture des décisions de fin d’année/)
    expect(screen.getByText(/La saisie des notes s’arrête à la date de début de revue de chaque période/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: "2027-05-15" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la date" }))

    await waitFor(() => expect(updateSchoolYearReviewDateMock).toHaveBeenCalledWith("year-1", {
      endOfYearReviewStartDate: "2027-05-15",
    }))
  })

  it("ne propose pas d’ajouter une période si le calendrier ne peut pas être chargé", async () => {
    listGradingPeriodsMock.mockRejectedValue(new Error("Calendrier indisponible"))
    renderPage()

    expect(await screen.findByText("Données indisponibles")).toBeInTheDocument()
    expect(screen.getByText(/Réessayez avant de le modifier/)).toBeInTheDocument()
    expect(screen.queryByText("Ajouter la période 1")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ajouter la période" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Réessayer/i })).toBeInTheDocument()
  })

  it("affiche le chevauchement et enregistre la date de revue d'une période", async () => {
    listGradingPeriodsMock.mockResolvedValue([
      { id: "p1", schoolYearId: "year-1", label: "T1", orderIndex: 1, startDate: "2026-09-01", reviewStartDate: "2026-11-15", endDate: "2026-12-20", notesEntryOpen: false, conductReviewOpen: true, isClosed: false },
      { id: "p2", schoolYearId: "year-1", label: "T2", orderIndex: 2, startDate: "2026-11-15", reviewStartDate: "2027-02-15", endDate: "2027-03-31", notesEntryOpen: true, conductReviewOpen: false, isClosed: false },
    ])
    updateGradingPeriodMock.mockResolvedValue({})
    renderPage()
    expect(await screen.findByText("Chevauchement avec T1")).toBeInTheDocument()
    const form = screen.getByRole("button", { name: "Enregistrer T1" }).closest("form")!
    fireEvent.change(form.querySelector<HTMLInputElement>('input[name="reviewStartDate"]')!, { target: { value: "2026-11-10" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer T1" }))
    await waitFor(() => expect(updateGradingPeriodMock).toHaveBeenCalledWith("p1", expect.objectContaining({ reviewStartDate: "2026-11-10" })))
  })

  it("limite une année semestrielle à deux périodes et crée le second semestre", async () => {
    listSchoolYearsMock.mockResolvedValue([{ ...activeYear, gradingPeriodType: "semester" }])
    listGradingPeriodsMock.mockResolvedValue([
      { id: "s1", schoolYearId: "year-1", label: "1er semestre", orderIndex: 1, startDate: "2026-09-01", reviewStartDate: "2027-01-15", endDate: "2027-02-15", notesEntryOpen: false, conductReviewOpen: true, isClosed: false },
    ])
    createGradingPeriodMock.mockResolvedValue({})
    renderPage()

    const addHeading = await screen.findByText("Ajouter la période 2")
    const addForm = addHeading.closest("form")!
    fireEvent.change(addForm.querySelector<HTMLInputElement>('input[name="label"]')!, { target: { value: "2e semestre" } })
    fireEvent.change(addForm.querySelector<HTMLInputElement>('input[name="startDate"]')!, { target: { value: "2027-01-15" } })
    fireEvent.change(addForm.querySelector<HTMLInputElement>('input[name="reviewStartDate"]')!, { target: { value: "2027-05-31" } })
    fireEvent.change(addForm.querySelector<HTMLInputElement>('input[name="endDate"]')!, { target: { value: "2027-06-30" } })
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la période" }))

    await waitFor(() => expect(createGradingPeriodMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "semester", orderIndex: 2, label: "2e semestre", reviewStartDate: "2027-05-31",
    })))
  })

  it("signale les anciennes périodes sans transition de saisie", async () => {
    listGradingPeriodsMock.mockResolvedValue([
      { id: "p1", schoolYearId: "year-1", label: "T1", orderIndex: 1, startDate: "2026-09-01", reviewStartDate: "2026-12-15", endDate: "2026-12-15", hasGeneratedCards: false },
      { id: "p2", schoolYearId: "year-1", label: "T2", orderIndex: 2, startDate: "2027-01-01", reviewStartDate: "2027-03-15", endDate: "2027-03-15", hasGeneratedCards: false },
    ])
    renderPage()

    expect(await screen.findByText("Transition à corriger avec T1")).toBeInTheDocument()
    expect(screen.queryByText("Chevauchement avec T1")).not.toBeInTheDocument()
  })
})
