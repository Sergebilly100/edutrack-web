import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { listMock, validateMock, previewMock, bulkValidateMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  validateMock: vi.fn(),
  previewMock: vi.fn(),
  bulkValidateMock: vi.fn(),
}))

vi.mock("@/modules/class-decisions/class-decisions.api", () => ({
  listClassDecisions: () => listMock(),
  listFilteredClassDecisions: () => listMock(),
  validateClassDecision: (studentId: string, payload: unknown) => validateMock(studentId, payload),
  previewBulkClassDecisions: (payload: unknown) => previewMock(payload),
  validateBulkClassDecisions: (payload: unknown) => bulkValidateMock(payload),
}))

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: () => true, refreshPermissions: vi.fn() }),
}))

vi.mock("@/shared/components/OfflineIndicator", () => ({ OfflineIndicator: () => null }))

import ClassDecisionsPage from "@/modules/class-decisions/ClassDecisionsPage"

const decision = {
  studentId: "student-1",
  studentFirstName: "Aminata",
  studentLastName: "Koné",
  studentMatricule: "MAT-001",
  className: "6ème A",
  currentLevelName: "6ème",
  generalAverage: 14.5,
  suggestedDecision: null,
  finalDecision: "repeat" as const,
  nextLevelId: null,
  nextLevelName: null,
  validatedAt: "2027-06-01T12:00:00.000Z",
}

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <ClassDecisionsPage />
  </QueryClientProvider>,
)

describe("ClassDecisionsPage", () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    listMock.mockResolvedValue({
      schoolYear: {
        id: "year-1",
        label: "09/2026 - 06/2027",
        endDate: "2027-06-30",
        endOfYearReviewStartDate: "2027-05-31",
      },
      decisions: [decision],
      levels: [{ id: "level-1", name: "5ème", orderIndex: 2 }],
      classes: [{ id: "class-1", name: "6ème A", levelId: "level-1" }],
    })
    validateMock.mockResolvedValue(decision)
    previewMock.mockResolvedValue({
      items: [{ ...decision, currentLevelId: "level-1", proposedDecision: "promoted", proposedNextLevelId: "level-1", proposedNextLevelName: "5ème", isEligible: true, blockingReason: null }],
      eligibleCount: 1,
      pendingCount: 0,
      canApply: true,
    })
    bulkValidateMock.mockResolvedValue({
      items: [], eligibleCount: 1, pendingCount: 0, canApply: true,
    })
  })

  it("affiche la saisie manuelle lorsque le module Notes n’est pas disponible", async () => {
    renderPage()
    expect(await screen.findAllByText("Koné Aminata")).not.toHaveLength(0)
    expect(screen.getAllByText(/saisie manuelle/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText("14,5/20").length).toBeGreaterThan(0)
  })

  it("permet au responsable autorisé de confirmer une décision", async () => {
    renderPage()
    const buttons = await screen.findAllByRole("button", { name: "Mettre à jour" })
    fireEvent.click(buttons[0]!)

    await waitFor(() => expect(validateMock).toHaveBeenCalledWith("student-1", {
      finalDecision: "repeat",
      nextLevelId: null,
    }))
  })

  it("prévisualise les décisions groupées avant leur validation finale", async () => {
    renderPage()
    expect(await screen.findByRole("button", { name: "Décision automatique" })).toBeDisabled()
    fireEvent.click(await screen.findByRole("combobox", { name: "Niveau" }))
    fireEvent.click(await screen.findByRole("option", { name: "5ème" }))
    fireEvent.click(screen.getByRole("button", { name: "Décision automatique" }))
    expect(await screen.findByRole("heading", { name: "Configurer la décision automatique" })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole("combobox", { name: /note supérieure.*niveau de destination/i }))
    fireEvent.click(await screen.findByRole("option", { name: "5ème" }))
    fireEvent.click(screen.getByRole("button", { name: /voir la prévisualisation/i }))

    expect(await screen.findByRole("heading", { name: "Prévisualisation des décisions" })).toBeInTheDocument()
    expect(screen.getByText("Décision proposée")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Valider définitivement" })).toBeEnabled()

    fireEvent.click(screen.getByRole("button", { name: "Valider définitivement" }))
    await waitFor(() => expect(bulkValidateMock).toHaveBeenCalledTimes(1))
  })
})
