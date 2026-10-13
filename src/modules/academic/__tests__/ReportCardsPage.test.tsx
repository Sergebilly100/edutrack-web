import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchClassCompletion: vi.fn(),
  fetchClassReportCards: vi.fn(),
  fetchConductBulletinAudit: vi.fn(),
  fetchReadiness: vi.fn(),
  generateReportCards: vi.fn(),
  listReportCardClasses: vi.fn(),
  listGradingPeriodsForYear: vi.fn(),
  listLevels: vi.fn(),
  listSchoolYears: vi.fn(),
  publishBulkReportCards: vi.fn(),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  fetchClassCompletion: (...args: unknown[]) => mocks.fetchClassCompletion(...args),
  fetchClassReportCards: (...args: unknown[]) => mocks.fetchClassReportCards(...args),
  fetchConductBulletinAudit: () => mocks.fetchConductBulletinAudit(),
  fetchReadiness: (...args: unknown[]) => mocks.fetchReadiness(...args),
  generateReportCards: (...args: unknown[]) => mocks.generateReportCards(...args),
  listReportCardClasses: (...args: unknown[]) => mocks.listReportCardClasses(...args),
  listGradingPeriodsForYear: (...args: unknown[]) => mocks.listGradingPeriodsForYear(...args),
  listLevels: () => mocks.listLevels(),
  listSchoolYears: () => mocks.listSchoolYears(),
  publishBulkReportCards: (...args: unknown[]) => mocks.publishBulkReportCards(...args),
  publishReportCard: vi.fn(),
  requestReportCardPdf: vi.fn(),
}))

vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: (key: string) => key === "report_cards.view" || key === "report_cards.publish" }),
}))

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

const selectOption = async (label: RegExp, option: string | RegExp) => {
  const trigger = await screen.findByRole("combobox", { name: label })
  await waitFor(() => expect(trigger).toBeEnabled())
  fireEvent.click(trigger)
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
    mocks.listSchoolYears.mockResolvedValue([{ id: "year-1", label: "2026-2027", status: "active" }])
    mocks.listReportCardClasses.mockResolvedValue([
      { id: "class-1", name: "6ème A", isActive: true, level: { id: "level-1" } },
      { id: "class-2", name: "5ème B", isActive: true, level: { id: "level-2" } },
    ])
    mocks.listLevels.mockResolvedValue([
      { id: "level-2", name: "5ème", orderIndex: 2 },
      { id: "level-1", name: "6ème", orderIndex: 1 },
      { id: "level-3", name: "4ème", orderIndex: 2 },
    ])
    mocks.listGradingPeriodsForYear.mockResolvedValue([{ id: "period-1", schoolYearId: "year-1", label: "Trimestre 1", isCurrent: true, isCompleted: false, bulletinGenerationAvailable: true }])
    mocks.fetchReadiness.mockResolvedValue([{ classId: "class-1", className: "6ème A", headcount: 2, studentsWithGeneralAverage: 1, readyToGenerate: false }])
    mocks.fetchClassCompletion.mockResolvedValue({
      subjects: [{ subjectId: "subject-1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: false, teacher: { id: "teacher-1", name: "Awa Koné" } }],
    })
    mocks.fetchClassReportCards.mockResolvedValue([])
    mocks.fetchConductBulletinAudit.mockResolvedValue([])
    mocks.generateReportCards.mockResolvedValue({ generatedCount: 2, periodCompleted: false })
    mocks.publishBulkReportCards.mockResolvedValue({ publishedCount: 1 })
  })

  it("affiche les blocages dans l’espace Bulletins et empêche la génération", async () => {
    renderPage()

    await waitFor(() => expect(screen.getByRole("combobox", { name: /classe/i })).toBeEnabled())
    fireEvent.click(screen.getByRole("combobox", { name: /classe/i }))
    fireEvent.click(await screen.findByRole("option", { name: "6ème A" }))

    expect(await screen.findByText("Préparation de la classe")).toBeInTheDocument()
    expect(await screen.findByText("Mathématiques")).toBeInTheDocument()
    expect(screen.getByText("Saisie en cours")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /générer les bulletins/i })).toBeDisabled()
    expect(screen.getByText("Clôturez et validez les moyennes de chaque matière avant de générer.")).toBeInTheDocument()
  })

  it("signale séparément les notes finales de conduite manquantes", async () => {
    mocks.fetchReadiness.mockResolvedValue([{ classId: "class-1", className: "6ème A", headcount: 2, studentsWithGeneralAverage: 2, studentsWithFinalConduct: 1, readyToGenerate: false }])
    mocks.fetchClassCompletion.mockResolvedValue({ subjects: [{ subjectId: "subject-1", subjectName: "Mathématiques", status: "completed", teacher: null }] })
    renderPage()
    await selectOption(/classe/i, "6ème A")
    expect(await screen.findByText("1/2 conduites finales")).toBeInTheDocument()
    expect(screen.getByText("Arrêtez la note finale de conduite de chaque élève confirmé.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /générer les bulletins/i })).toBeDisabled()
  })

  it("explique pourquoi une classe sans inscription confirmée ne peut pas générer de bulletins", async () => {
    mocks.fetchReadiness.mockResolvedValue([{ classId: "class-1", className: "6ème A", headcount: 0, studentsWithGeneralAverage: 0, readyToGenerate: false }])
    renderPage()

    await waitFor(() => expect(screen.getByRole("combobox", { name: /classe/i })).toBeEnabled())
    fireEvent.click(screen.getByRole("combobox", { name: /classe/i }))
    fireEvent.click(await screen.findByRole("option", { name: "6ème A" }))

    expect(await screen.findByText("Aucun élève confirmé")).toBeInTheDocument()
    expect(screen.getByText(/après la confirmation d’une inscription/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /générer les bulletins/i })).toBeDisabled()
  })

  it("rend une période à venir indisponible à la sélection", async () => {
    mocks.listGradingPeriodsForYear.mockResolvedValue([
      { id: "period-1", schoolYearId: "year-1", label: "Trimestre 1", isCurrent: true, isCompleted: false, bulletinGenerationAvailable: true },
      { id: "period-2", schoolYearId: "year-1", label: "Trimestre 2", isCurrent: false, isCompleted: false, bulletinGenerationAvailable: false },
    ])
    renderPage()

    await screen.findByText("Trimestre 1 · en revue")
    fireEvent.click(await screen.findByRole("combobox", { name: /période/i }))

    expect(screen.getByRole("option", { name: /trimestre 2.*à venir/i })).toHaveAttribute("aria-disabled", "true")
  })

  it("ordonne les niveaux et filtre les classes, puis retrouve toutes les classes", async () => {
    renderPage()

    fireEvent.click(await screen.findByRole("combobox", { name: /niveau/i }))
    await screen.findByRole("option", { name: "5ème" })
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Tous les niveaux", "6ème", "5ème",
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
    expect(screen.getByRole("combobox", { name: /période/i })).toHaveTextContent("Trimestre 1 · en revue")
    expect(await screen.findByText("Choisissez une classe et une période")).toBeInTheDocument()
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

    queryClient.setQueryData(["report-cards", "classes", "year-1"], [
      { id: "class-3", name: "6ème C", isActive: true, level: { id: "level-1" } },
    ])

    await waitFor(() => expect(screen.getByRole("combobox", { name: /classe/i })).toHaveTextContent("Choisir une classe"))
    expect(screen.getByText("Choisissez une classe et une période")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /période/i })).toHaveTextContent("Trimestre 1 · en revue")
    expect(mocks.fetchClassReportCards).toHaveBeenCalledTimes(1)
  })

  it("garde les appels de génération et de publication centrés sur la classe et la période", async () => {
    mocks.fetchReadiness.mockResolvedValue([{ classId: "class-1", className: "6ème A", headcount: 2, studentsWithGeneralAverage: 2, studentsWithFinalConduct: 2, readyToGenerate: true }])
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

  it("affiche les rangs élèves en français dans la liste direction", async () => {
    mocks.fetchClassReportCards.mockResolvedValue([
      { id: "card-1", rank: 1, studentName: "Aya", generalAverage: 16, status: "published" },
      { id: "card-2", rank: 2, studentName: "Yao", generalAverage: 14, status: "published" },
    ])
    renderPage()
    await selectOption(/classe/i, "6ème A")

    expect(await screen.findByRole("cell", { name: "Rang : 1er" })).toHaveTextContent("1er")
    expect(screen.getByRole("cell", { name: "Rang : 2ème" })).toHaveTextContent("2ème")
  })

  it("sélectionne l’année active puis lit une classe archivée d’une année clôturée sans action d’écriture", async () => {
    mocks.listSchoolYears.mockResolvedValue([
      { id: "year-old", label: "2024-2025", status: "closed" },
      { id: "year-1", label: "2026-2027", status: "active" },
    ])
    mocks.listReportCardClasses.mockImplementation(async (yearId: string) => yearId === "year-old"
      ? [{ id: "class-old", name: "6ème Archives", isActive: false, level: { id: "level-1" } }]
      : [{ id: "class-1", name: "6ème A", isActive: true, level: { id: "level-1" } }])
    mocks.listGradingPeriodsForYear.mockImplementation(async (yearId: string) => yearId === "year-old"
      ? [{ id: "period-old", schoolYearId: "year-old", label: "Trimestre ancien", isClosed: false, hasGeneratedCards: true, bulletinGenerationAvailable: false }]
      : [{ id: "period-1", schoolYearId: "year-1", label: "Trimestre 1", bulletinGenerationAvailable: true }])
    mocks.fetchClassReportCards.mockResolvedValue([{ id: "card-old", rank: 2, studentName: "Aya", generalAverage: 14, status: "published" }])
    renderPage()
    await waitFor(() => expect(screen.getByRole("combobox", { name: /année scolaire/i })).toHaveTextContent("2026-2027 · active"))
    await selectOption(/classe/i, "6ème A")
    await waitFor(() => expect(mocks.fetchClassReportCards).toHaveBeenCalledWith("class-1", "period-1"))

    await selectOption(/année scolaire/i, "2024-2025")
    expect(screen.getByRole("combobox", { name: /classe/i })).toHaveTextContent("Choisir une classe")
    expect(await screen.findByText("Choisissez une classe et une période")).toBeInTheDocument()
    expect(mocks.fetchClassReportCards).toHaveBeenCalledTimes(1)
    await selectOption(/classe/i, /6ème Archives · archivée/)
    await waitFor(() => expect(mocks.fetchClassReportCards).toHaveBeenCalledWith("class-old", "period-old"))
    expect(await screen.findByText("Aya")).toBeInTheDocument()
    expect(screen.getByText("Publié")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /générer les bulletins|publier tous/i })).not.toBeInTheDocument()
    expect(mocks.fetchClassCompletion).toHaveBeenCalledTimes(1)
  })

  it("explique une année historique sans classe ni bulletin", async () => {
    mocks.listSchoolYears.mockResolvedValue([
      { id: "year-1", label: "2026-2027", status: "active" },
      { id: "year-empty", label: "2023-2024", status: "closed" },
    ])
    mocks.listReportCardClasses.mockImplementation(async (yearId: string) => yearId === "year-empty" ? [] : [{ id: "class-1", name: "6ème A", isActive: true, level: { id: "level-1" } }])
    mocks.listGradingPeriodsForYear.mockImplementation(async (yearId: string) => yearId === "year-empty" ? [] : [{ id: "period-1", schoolYearId: "year-1", bulletinGenerationAvailable: true }])
    renderPage()
    await selectOption(/année scolaire/i, "2023-2024")
    expect(await screen.findByText("Aucune classe pour 2023-2024")).toBeInTheDocument()
    expect(screen.getByText(/ni classe exploitable.*ni bulletin historique/)).toBeInTheDocument()
  })

  it("laisse une classe archivée de l’année active en consultation seule", async () => {
    mocks.listReportCardClasses.mockResolvedValue([
      { id: "class-archived", name: "6ème Archive", isActive: false, level: { id: "level-1" } },
    ])
    mocks.listGradingPeriodsForYear.mockResolvedValue([
      { id: "period-1", schoolYearId: "year-1", label: "Trimestre 1", isClosed: true, hasGeneratedCards: true, bulletinGenerationAvailable: false },
    ])
    mocks.fetchClassReportCards.mockResolvedValue([
      { id: "card-generated", rank: 1, studentName: "Aya", generalAverage: 14, status: "generated" },
    ])
    renderPage()
    await selectOption(/classe/i, /6ème Archive · archivée/)
    expect(await screen.findByText("Aya")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /publier|générer/i })).not.toBeInTheDocument()
  })
})
