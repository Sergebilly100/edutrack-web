import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchClassCompletion: vi.fn(),
  fetchClassReportCards: vi.fn(),
  fetchReadiness: vi.fn(),
  generateReportCards: vi.fn(),
  listClasses: vi.fn(),
  listGradingPeriods: vi.fn(),
  listLevels: vi.fn(),
  publishBulkReportCards: vi.fn(),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  fetchClassCompletion: (...args: unknown[]) => mocks.fetchClassCompletion(...args),
  fetchClassReportCards: (...args: unknown[]) => mocks.fetchClassReportCards(...args),
  fetchReadiness: (...args: unknown[]) => mocks.fetchReadiness(...args),
  generateReportCards: (...args: unknown[]) => mocks.generateReportCards(...args),
  listClasses: () => mocks.listClasses(),
  listGradingPeriods: () => mocks.listGradingPeriods(),
  listLevels: () => mocks.listLevels(),
  publishBulkReportCards: (...args: unknown[]) => mocks.publishBulkReportCards(...args),
  publishReportCard: vi.fn(),
  requestReportCardPdf: vi.fn(),
}))

vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

import ReportCardsPage from "@/modules/academic/ReportCardsPage"

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ReportCardsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
  return { ...view, queryClient }
}

const selectOption = async (label: RegExp, option: string) => {
  fireEvent.click(await screen.findByRole("combobox", { name: label }))
  fireEvent.click(await screen.findByRole("option", { name: option }))
}

describe("ReportCardsPage", () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listClasses.mockResolvedValue({ classes: [
      { id: "class-1", name: "6ème A", level: { id: "level-1" } },
      { id: "class-2", name: "5ème B", level: { id: "level-2" } },
    ] })
    mocks.listLevels.mockResolvedValue([
      { id: "level-2", name: "5ème", orderIndex: 2 },
      { id: "level-1", name: "6ème", orderIndex: 1 },
      { id: "level-3", name: "4ème", orderIndex: 2 },
    ])
    mocks.listGradingPeriods.mockResolvedValue([{ id: "period-1", label: "Trimestre 1", isCurrent: true, isCompleted: false }])
    mocks.fetchReadiness.mockResolvedValue([{ classId: "class-1", className: "6ème A", headcount: 2, studentsWithGeneralAverage: 1, readyToGenerate: false }])
    mocks.fetchClassCompletion.mockResolvedValue({
      subjects: [{ subjectId: "subject-1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: false, teacher: { id: "teacher-1", name: "Awa Koné" } }],
    })
    mocks.fetchClassReportCards.mockResolvedValue([])
    mocks.generateReportCards.mockResolvedValue({ generatedCount: 2, periodCompleted: false })
    mocks.publishBulkReportCards.mockResolvedValue({ publishedCount: 1 })
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

  it("explique pourquoi une classe sans inscription confirmée ne peut pas générer de bulletins", async () => {
    mocks.fetchReadiness.mockResolvedValue([{ classId: "class-1", className: "6ème A", headcount: 0, studentsWithGeneralAverage: 0, readyToGenerate: false }])
    renderPage()

    fireEvent.click(await screen.findByRole("combobox", { name: /classe/i }))
    fireEvent.click(await screen.findByRole("option", { name: "6ème A" }))

    expect(await screen.findByText("Aucun élève confirmé")).toBeInTheDocument()
    expect(screen.getByText(/après la confirmation d’une inscription/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /générer les bulletins/i })).toBeDisabled()
  })

  it("rend une période à venir indisponible à la sélection", async () => {
    mocks.listGradingPeriods.mockResolvedValue([
      { id: "period-1", label: "Trimestre 1", isCurrent: true, isCompleted: false },
      { id: "period-2", label: "Trimestre 2", isCurrent: false, isCompleted: false },
    ])
    renderPage()

    await screen.findByText("Trimestre 1 · en cours")
    fireEvent.click(await screen.findByRole("combobox", { name: /période/i }))

    expect(screen.getByRole("option", { name: /trimestre 2.*à venir/i })).toHaveAttribute("aria-disabled", "true")
  })

  it("ordonne les niveaux et filtre les classes, puis retrouve toutes les classes", async () => {
    renderPage()

    fireEvent.click(await screen.findByRole("combobox", { name: /niveau/i }))
    await screen.findByRole("option", { name: "5ème" })
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Tous les niveaux", "6ème", "4ème", "5ème",
    ])
    fireEvent.click(screen.getByRole("option", { name: "6ème" }))

    fireEvent.click(screen.getByRole("combobox", { name: /classe/i }))
    expect(screen.getByRole("option", { name: "6ème A" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "5ème B" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("option", { name: "6ème A" }))

    await selectOption(/niveau/i, "Tous les niveaux")
    expect(screen.getByRole("combobox", { name: /classe/i })).toHaveTextContent("6ème A")
    fireEvent.click(screen.getByRole("combobox", { name: /classe/i }))
    expect(screen.getByRole("option", { name: "6ème A" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "5ème B" })).toBeInTheDocument()
  })

  it("ouvre le filtre Niveau au clavier avec une cible tactile suffisante", async () => {
    renderPage()
    const trigger = screen.getByRole("combobox", { name: /niveau/i })
    expect(trigger).toHaveClass("min-h-12")

    trigger.focus()
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" })

    expect(await screen.findByRole("option", { name: "Tous les niveaux" })).toBeInTheDocument()
  })

  it("efface une classe hors niveau, conserve la période et coupe les requêtes de classe", async () => {
    renderPage()
    await selectOption(/classe/i, "6ème A")
    await waitFor(() => expect(mocks.fetchClassReportCards).toHaveBeenCalledWith("class-1", "period-1"))

    await selectOption(/niveau/i, "5ème")

    expect(screen.getByRole("combobox", { name: /classe/i })).toHaveTextContent("Choisir une classe")
    expect(screen.getByRole("combobox", { name: /période/i })).toHaveTextContent("Trimestre 1 · en cours")
    expect(screen.getByText("Choisissez une classe et une période")).toBeInTheDocument()
    expect(mocks.fetchClassReportCards).toHaveBeenCalledTimes(1)
    expect(mocks.fetchClassCompletion).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("combobox", { name: /classe/i }))
    expect(screen.queryByRole("option", { name: "6ème A" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("option", { name: "5ème B" }))
    await waitFor(() => expect(mocks.fetchClassReportCards).toHaveBeenCalledWith("class-2", "period-1"))
  })

  it("efface une classe absente après un changement de l’année active", async () => {
    const { queryClient } = renderPage()
    await selectOption(/classe/i, "6ème A")
    await waitFor(() => expect(mocks.fetchClassReportCards).toHaveBeenCalledWith("class-1", "period-1"))

    queryClient.setQueryData(["academic", "classes-for-report-cards"], {
      classes: [{ id: "class-3", name: "6ème C", level: { id: "level-1" } }],
    })

    await waitFor(() => expect(screen.getByRole("combobox", { name: /classe/i })).toHaveTextContent("Choisir une classe"))
    expect(screen.getByText("Choisissez une classe et une période")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /période/i })).toHaveTextContent("Trimestre 1 · en cours")
    expect(mocks.fetchClassReportCards).toHaveBeenCalledTimes(1)
  })

  it("garde les appels de génération et de publication centrés sur la classe et la période", async () => {
    mocks.fetchReadiness.mockResolvedValue([{ classId: "class-1", className: "6ème A", headcount: 2, studentsWithGeneralAverage: 2, readyToGenerate: true }])
    mocks.fetchClassCompletion.mockResolvedValue({ subjects: [
      { subjectId: "subject-1", subjectName: "Mathématiques", status: "completed", teacher: { id: "teacher-1", name: "Awa Koné" } },
    ] })
    mocks.fetchClassReportCards.mockResolvedValue([{ id: "card-1", rank: 1, studentName: "Élève", generalAverage: 12, status: "generated" }])
    renderPage()
    await selectOption(/niveau/i, "6ème")
    await selectOption(/classe/i, "6ème A")

    fireEvent.click(await screen.findByRole("button", { name: /générer les bulletins/i }))
    await waitFor(() => expect(mocks.generateReportCards).toHaveBeenCalledWith({ class_id: "class-1", grading_period_id: "period-1" }))
    fireEvent.click(await screen.findByRole("button", { name: /publier tous les générés/i }))
    await waitFor(() => expect(mocks.publishBulkReportCards).toHaveBeenCalledWith({ class_id: "class-1", grading_period_id: "period-1" }))
  })
})
