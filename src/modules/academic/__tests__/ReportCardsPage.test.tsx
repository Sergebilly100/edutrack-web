import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchClassCompletion: vi.fn(),
  fetchClassReportCards: vi.fn(),
  fetchReadiness: vi.fn(),
  listClasses: vi.fn(),
  listGradingPeriods: vi.fn(),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  fetchClassCompletion: (...args: unknown[]) => mocks.fetchClassCompletion(...args),
  fetchClassReportCards: (...args: unknown[]) => mocks.fetchClassReportCards(...args),
  fetchReadiness: (...args: unknown[]) => mocks.fetchReadiness(...args),
  generateReportCards: vi.fn(),
  listClasses: () => mocks.listClasses(),
  listGradingPeriods: () => mocks.listGradingPeriods(),
  publishBulkReportCards: vi.fn(),
  publishReportCard: vi.fn(),
  requestReportCardPdf: vi.fn(),
}))

vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

import ReportCardsPage from "@/modules/academic/ReportCardsPage"

const renderPage = () => render(
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ReportCardsPage />
    </QueryClientProvider>
  </MemoryRouter>,
)

describe("ReportCardsPage", () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listClasses.mockResolvedValue({ classes: [{ id: "class-1", name: "6ème A" }] })
    mocks.listGradingPeriods.mockResolvedValue([{ id: "period-1", label: "Trimestre 1", isCurrent: true, isCompleted: false }])
    mocks.fetchReadiness.mockResolvedValue([{ classId: "class-1", className: "6ème A", headcount: 2, studentsWithGeneralAverage: 1, readyToGenerate: false }])
    mocks.fetchClassCompletion.mockResolvedValue({
      subjects: [{ subjectId: "subject-1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: false, teacher: { id: "teacher-1", name: "Awa Koné" } }],
    })
    mocks.fetchClassReportCards.mockResolvedValue([])
  })

  it("affiche les blocages dans l’espace Bulletins et empêche la génération", async () => {
    renderPage()

    fireEvent.click(await screen.findByRole("combobox", { name: /classe/i }))
    fireEvent.click(await screen.findByRole("option", { name: "6ème A" }))

    expect(await screen.findByText("Préparation de la classe")).toBeInTheDocument()
    expect(await screen.findByText("Mathématiques")).toBeInTheDocument()
    expect(screen.getByText("Saisie à clôturer")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /générer les bulletins/i })).toBeDisabled()
    expect(screen.getByText("Clôturez et validez les moyennes de chaque matière avant de générer.")).toBeInTheDocument()
  })
})
