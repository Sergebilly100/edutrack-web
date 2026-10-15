import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ years: vi.fn(), periods: vi.fn(), updateDate: vi.fn(), updatePeriod: vi.fn(), createPeriod: vi.fn() }))
vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: () => mocks.years(), listGradingPeriods: () => mocks.periods(),
  updateSchoolYearReviewDate: (id: string, payload: unknown) => mocks.updateDate(id, payload),
  updateGradingPeriod: (id: string, payload: unknown) => mocks.updatePeriod(id, payload),
  createGradingPeriod: (payload: unknown) => mocks.createPeriod(payload),
}))
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true }) }))
vi.mock("@/shared/components/OfflineIndicator", () => ({ OfflineIndicator: () => null }))

import SchoolYearsPage from "@/modules/academic/SchoolYearsPage"

const year = { id: "y1", label: "09/2026 - 06/2027", startDate: "2026-09-01", endDate: "2027-06-30", endOfYearReviewStartDate: "2027-05-31", gradingPeriodType: "trimester", status: "active" }
const past = { id: "y0", label: "09/2025 - 06/2026", startDate: "2025-09-01", endDate: "2026-06-30", endOfYearReviewStartDate: "2026-05-31", gradingPeriodType: "trimester", status: "closed" }
const p1 = { id: "p1", schoolYearId: "y1", label: "Trimestre 1", orderIndex: 1, startDate: "2026-09-01", reviewStartDate: "2026-10-10", endDate: "2026-10-30", isClosed: true, hasGeneratedCards: false, notesEntryOpen: false, conductReviewOpen: false }
const p2 = { id: "p2", schoolYearId: "y1", label: "Trimestre 2", orderIndex: 2, startDate: "2026-10-08", reviewStartDate: "2027-02-01", endDate: "2027-02-15", isClosed: false, hasGeneratedCards: false, notesEntryOpen: true, conductReviewOpen: false }
const p3 = { id: "p3", schoolYearId: "y1", label: "Trimestre 3", orderIndex: 3, startDate: "2027-01-30", reviewStartDate: "2027-05-15", endDate: "2027-06-30", isClosed: false, hasGeneratedCards: false, notesEntryOpen: true, conductReviewOpen: false }
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={["/academic/school-years"]}><SchoolYearsPage /></MemoryRouter></QueryClientProvider>)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  mocks.years.mockResolvedValue([year, past])
  mocks.periods.mockResolvedValue([p1, p2, p3])
  mocks.updateDate.mockResolvedValue(year)
  mocks.updatePeriod.mockResolvedValue(p2)
  mocks.createPeriod.mockResolvedValue({})
})

describe("SchoolYearsPage", () => {
  it("affiche un seul statut et relie la sélection aux blocs", async () => {
    renderPage()
    expect(await screen.findByRole("heading", { name: /Calendrier de l’année · 09\/2026/ })).toBeVisible()
    expect(screen.getAllByText("Active")).toHaveLength(1)
    expect(screen.queryByText("Année en cours")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: past.label }))
    expect(screen.getByRole("heading", { name: `Périodes d’évaluation · ${past.label}` })).toBeVisible()
    expect(screen.getByRole("heading", { name: `Calendrier de l’année · ${past.label}` })).toBeVisible()
    expect(screen.queryByRole("button", { name: "Enregistrer la date" })).not.toBeInTheDocument()
  })

  it("ouvre la période courante, garde la période clôturée repliée et valide avant enregistrement", async () => {
    renderPage()
    expect(await screen.findByText(/Recouvre Trimestre 1 du/)).toBeVisible()
    expect(screen.getByRole("button", { name: /Trimestre 1 Clôturée/ })).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(screen.getByRole("button", { name: "Modifier Trimestre 2" }))
    const save = screen.getByRole("button", { name: "Enregistrer Trimestre 2" })
    expect(save).toBeDisabled()
    const review = screen.getByLabelText(/Début de revue/)
    fireEvent.change(review, { target: { value: "2026-10-01" } })
    expect(screen.getByText(/Doit commencer après la revue de la période précédente/)).toBeVisible()
    expect(save).toBeDisabled()
    fireEvent.change(review, { target: { value: "2027-02-02" } })
    expect(save).toBeEnabled()
    expect(screen.getByText("Modifications non enregistrées")).toBeVisible()
    fireEvent.click(save)
    expect(screen.getByRole("alertdialog")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l’enregistrement" }))
    await waitFor(() => expect(mocks.updatePeriod).toHaveBeenCalledWith("p2", expect.objectContaining({ reviewStartDate: "2027-02-02" })))
  })

  it("annule les modifications sans appel API", async () => {
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: "Modifier Trimestre 2" }))
    fireEvent.change(screen.getByLabelText(/Début de revue/), { target: { value: "2027-02-02" } })
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(screen.queryByText("Modifications non enregistrées")).not.toBeInTheDocument()
    expect(mocks.updatePeriod).not.toHaveBeenCalled()
  })

  it("bloque l’accès à Fin d’année avant la date puis l’ouvre après", async () => {
    renderPage()
    await screen.findByRole("heading", { name: /Décisions de fin d’année ·/ })
    expect(screen.getByRole("button", { name: "Ouvrir Fin d’année" })).toBeDisabled()
    expect(screen.getByText(/Disponible à partir du 31\/05\/2027/)).toBeVisible()
  })

  it("propose la route existante quand la date d’ouverture est passée", async () => {
    mocks.years.mockResolvedValue([{ ...year, endOfYearReviewStartDate: "2026-10-01" }])
    renderPage()
    expect(await screen.findByRole("link", { name: "Ouvrir Fin d’année" })).toHaveAttribute("href", "/end-of-year")
  })

  it("enregistre uniquement une date de décision valide modifiée", async () => {
    renderPage()
    const input = await screen.findByLabelText("Ouverture des décisions de fin d’année")
    const save = screen.getByRole("button", { name: "Enregistrer la date" })
    expect(save).toBeDisabled()
    fireEvent.change(input, { target: { value: "2027-07-01" } })
    expect(save).toBeDisabled()
    fireEvent.change(input, { target: { value: "2027-05-15" } })
    fireEvent.click(save)
    await waitFor(() => expect(mocks.updateDate).toHaveBeenCalledWith("y1", { endOfYearReviewStartDate: "2027-05-15" }))
  })

  it("n’ajoute aucune période quand le chargement échoue", async () => {
    mocks.periods.mockRejectedValue(new Error("hors ligne"))
    renderPage()
    expect(await screen.findByText(/Réessayez avant de le modifier/)).toBeVisible()
    expect(screen.queryByRole("button", { name: "Ajouter la période" })).not.toBeInTheDocument()
  })

  it("signale une transition réellement invalide", async () => {
    mocks.periods.mockResolvedValue([p1, { ...p2, startDate: "2026-11-01" }, p3])
    renderPage()
    expect(await screen.findByText(/Transition avec Trimestre 1/)).toBeVisible()
  })

  it("conserve la création d’une période pour une année active incomplète", async () => {
    mocks.years.mockResolvedValue([{ ...year, gradingPeriodType: "semester" }])
    mocks.periods.mockResolvedValue([{ ...p1, label: "1er semestre", reviewStartDate: "2027-01-15", endDate: "2027-02-15" }])
    renderPage()
    const title = await screen.findByText("Ajouter la période 2")
    const form = title.parentElement!
    fireEvent.change(within(form).getByLabelText("Nom"), { target: { value: "2e semestre" } })
    const inputs = form.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(inputs[0], { target: { value: "2027-01-15" } })
    fireEvent.change(inputs[1], { target: { value: "2027-05-31" } })
    fireEvent.change(inputs[2], { target: { value: "2027-06-30" } })
    fireEvent.click(within(form).getByRole("button", { name: "Ajouter la période" }))
    await waitFor(() => expect(mocks.createPeriod).toHaveBeenCalledWith(expect.objectContaining({ type: "semester", orderIndex: 2, label: "2e semestre" })))
  })
})
