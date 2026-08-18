import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { listMock, validateMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  validateMock: vi.fn(),
}))

vi.mock("@/modules/class-decisions/class-decisions.api", () => ({
  listClassDecisions: () => listMock(),
  validateClassDecision: (studentId: string, payload: unknown) => validateMock(studentId, payload),
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
    })
    validateMock.mockResolvedValue(decision)
  })

  it("affiche la saisie manuelle lorsque le module Notes n’est pas disponible", async () => {
    renderPage()
    expect(await screen.findAllByText("Koné Aminata")).not.toHaveLength(0)
    expect(screen.getAllByText(/saisie manuelle/i).length).toBeGreaterThan(0)
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
})
