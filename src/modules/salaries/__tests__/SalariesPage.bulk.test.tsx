import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const permissions = vi.hoisted(() => new Set(["salary.view", "salary.mark_paid", "salary.compute", "salary.export"]))
const stale = vi.hoisted(() => ({ value: false }))
const computeMock = vi.hoisted(() => vi.fn())
const item = (id: string, type: "vacataire" | "permanent") => ({
  needsRecalculation: stale.value,
  teacherId: id, teacherName: `Prof ${id}`, teacherType: type, hoursPlanned: 10, hoursDone: 8, hourlyRate: 3500,
  totalFcfa: 28000, amountAlreadyPaid: 0, status: "pending", salaryRecordId: `rec-${id}`, isPartiallyPaid: false, paidAt: null,
})

vi.mock("@/modules/salaries/components/SalariesStatsCards", () => ({ SalariesStatsCards: () => null }))
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (key: string) => permissions.has(key) }) }))
vi.mock("@/modules/salaries/salaries.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/salaries/salaries.api")>()),
  getSalarySummary: vi.fn(async () => ({ month: "2026-11", items: [item("v1", "vacataire"), item("p1", "permanent")] })),
  computeSalaries: computeMock,
  getSalaryUnpaidAlerts: vi.fn(async () => ({ months: [], totalRemainingFcfa: 0 })),
  getSalariesStats: vi.fn(async () => ({})),
}))

import SalariesPage from "../SalariesPage"

describe("SalariesPage – sélection groupée", () => {
  it("affiche les cases à cocher des tableaux vacataires et permanents", async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><SalariesPage /></MemoryRouter></QueryClientProvider>)
    await waitFor(() => expect(screen.getByLabelText("Tout sélectionner")).toBeInTheDocument())
    expect(screen.getByLabelText("Sélectionner Prof v1")).toBeInTheDocument()
    expect(screen.getByLabelText("Tout sélectionner (permanents)")).toBeInTheDocument()
    expect(screen.getByLabelText("Sélectionner Prof p1")).toBeInTheDocument()
  })
})

const renderPageEarly = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><SalariesPage /></MemoryRouter></QueryClientProvider>)

describe("SalariesPage – paiement groupé exclusif", () => {
  beforeEach(() => { stale.value = false })

  it("sélectionner l'autre groupe annule la première sélection : une seule barre et une seule fenêtre", async () => {
    renderPageEarly()
    fireEvent.click(await screen.findByLabelText("Tout sélectionner"))
    expect(screen.getAllByRole("button", { name: /Marquer payés/ })).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: /Marquer payés \(1 vacataire\)/ }))
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    fireEvent.keyDown(document, { key: "Escape" })
    fireEvent.click(screen.getByLabelText("Tout sélectionner"))
    fireEvent.click(screen.getByLabelText("Tout sélectionner (permanents)"))
    expect(screen.queryByRole("button", { name: /vacataire\)/ })).toBeNull()
    expect(screen.getByLabelText("Sélectionner Prof v1")).toHaveAttribute("data-state", "unchecked")
    const pay = screen.getAllByRole("button", { name: /Marquer payés/ })
    expect(pay).toHaveLength(1)
    fireEvent.click(pay[0])
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    expect(screen.getByText("Confirmer le paiement groupé (permanents)")).toBeInTheDocument()
  })
})

const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><SalariesPage /></MemoryRouter></QueryClientProvider>)

describe("SalariesPage – recalcul nécessaire", () => {
  beforeEach(() => {
    computeMock.mockReset()
    computeMock.mockResolvedValue({ month: "2026-11", updatedCount: 2 })
    stale.value = true
    permissions.add("salary.compute")
  })

  it("recalcule automatiquement une seule fois quand l'utilisateur peut calculer", async () => {
    renderPage()
    await waitFor(() => expect(computeMock).toHaveBeenCalledTimes(1))
    expect(computeMock.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}$/)
  })

  it("sans droit de calcul : bandeau explicatif, aucun appel, aucun bouton", async () => {
    permissions.delete("salary.compute")
    renderPage()
    const banner = await screen.findByTestId("salaries-recalc-banner")
    expect(banner).toHaveTextContent(/2 fiches de salaire à recalculer/)
    expect(banner).toHaveTextContent(/Demandez à un responsable/)
    expect(computeMock).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Recalculer maintenant" })).toBeNull()
  })

  it("fiches à jour : ni bandeau ni recalcul", async () => {
    stale.value = false
    renderPage()
    await screen.findByLabelText("Tout sélectionner")
    expect(screen.queryByTestId("salaries-recalc-banner")).toBeNull()
    expect(computeMock).not.toHaveBeenCalled()
  })

  it("échec du recalcul automatique : le bandeau reste avec « Recalculer maintenant »", async () => {
    computeMock.mockRejectedValueOnce(new Error("boom"))
    renderPage()
    expect(await screen.findByRole("button", { name: "Recalculer maintenant" })).toBeInTheDocument()
  })
})
