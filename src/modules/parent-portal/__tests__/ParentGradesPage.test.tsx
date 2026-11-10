import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({ students: vi.fn(), grades: vi.fn(), reportCards: vi.fn() }))
vi.mock("../parent.api", () => ({
  listParentStudents: api.students,
  getParentGrades: api.grades,
  listParentReportCards: api.reportCards,
}))
vi.mock("@/shared/components/OfflineIndicator", () => ({ OfflineIndicator: () => null }))

import ParentGradesPage from "../ParentGradesPage"

const students = [
  { id: "aya", first_name: "Aya", last_name: "Koné", class_name: "6ème A" },
  { id: "yao", first_name: "Yao", last_name: "Koné", class_name: "5ème B" },
]
const t1 = { id: "period-t1", label: "Trimestre 1", isCurrent: false }
const t2 = { id: "period-t2", label: "Trimestre 2", isCurrent: true }

const gradeResponse = (periodId: string, withSubject = true, inRevision = false) => ({
  schoolYear: { id: "year-active", label: "2026-2027" },
  periods: [t2, t1],
  selectedGradingPeriodId: periodId,
  resultsInRevision: inRevision,
  conductGrade: withSubject ? 14.5 : null,
  subjects: withSubject ? [{
    id: "subject-math",
    name: "Mathématiques et sciences appliquées",
    average: 16.25,
    rank: 2,
    comment: "Commentaire réservé à l’équipe",
    evaluations: [
      {
        id: "evaluation-test",
        label: "Composition écrite avec un libellé volontairement long",
        date: "2026-10-15",
        type: "scheduled",
        coefficient: 2,
        score: 8.5,
        maxScore: 10,
        comment: "Appréciation privée",
      },
      {
        id: "evaluation-spontaneous",
        label: "Note spontanée -1",
        date: "2026-10-17",
        type: "spontaneous",
        coefficient: 1,
        score: -1,
        maxScore: 20,
      },
    ],
  }] : [],
})

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
})

const renderGradesPage = (queryClient: QueryClient) => render(
  <MemoryRouter>
    <QueryClientProvider client={queryClient}><ParentGradesPage /></QueryClientProvider>
  </MemoryRouter>,
)

const choose = async (name: string, option: string) => {
  fireEvent.click(await screen.findByRole("combobox", { name }))
  fireEvent.click(await screen.findByRole("option", { name: option }))
}

describe("ParentGradesPage", () => {
  beforeEach(() => {
    sessionStorage.clear()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })
    api.students.mockReset()
    api.grades.mockReset()
    api.reportCards.mockReset()
    api.students.mockResolvedValue(students)
    api.reportCards.mockResolvedValue({ reportCards: [], availableSchoolYears: [], inRevision: false })
    api.grades.mockImplementation(async (studentId: string, periodId?: string) => {
      const period = periodId ?? "period-t2"
      return gradeResponse(period, period === "period-t2")
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("affiche les notes validées, les coefficients et les barèmes sans données internes", async () => {
    const queryClient = createQueryClient()
    const view = renderGradesPage(queryClient)
    try {
      expect(await screen.findByText("16,25")).toBeInTheDocument()
      expect(screen.getByText("Conduite")).toBeInTheDocument()
      expect(screen.getByText("14,50")).toBeInTheDocument()
      expect(screen.queryByText("Composition écrite avec un libellé volontairement long")).not.toBeInTheDocument()
      const subjectCard = screen.getByTestId("parent-grade-subject-subject-math")
      const subjectTrigger = screen.getByRole("button", {
        name: "Notes et évaluations de Mathématiques et sciences appliquées",
      })
      expect(subjectTrigger).toHaveAttribute("aria-expanded", "false")
      expect(subjectCard).toHaveClass("group-data-[state=open]/subject:border-primary")
      fireEvent.click(subjectTrigger)
      expect(subjectTrigger).toHaveAttribute("aria-expanded", "true")
      expect(await screen.findByText("Note spontanée -1")).toBeInTheDocument()
      expect(screen.getByText("Composition écrite avec un libellé volontairement long")).toBeInTheDocument()
      expect(screen.getByText("8,5 / 10")).toBeInTheDocument()
      expect(screen.getByText("-1 / 20")).toBeInTheDocument()
      expect(screen.getByText((_, element) =>
        element?.tagName === "P" && (element.textContent?.includes("Coefficient 2") ?? false)
      )).toBeInTheDocument()
      expect(screen.queryByText("Appréciation privée")).not.toBeInTheDocument()
      expect(screen.queryByText("Commentaire réservé à l’équipe")).not.toBeInTheDocument()
      expect(screen.queryByText("Rang 2")).not.toBeInTheDocument()
      expect(queryClient.getQueryData(["parent", "grades", "aya", null])).toBeDefined()
    } finally {
      view.unmount()
      queryClient.clear()
    }
  })

  it("ferme automatiquement la matière ouverte quand une autre est dépliée", async () => {
    api.grades.mockImplementation(async () => {
      const response = gradeResponse("period-t2")
      return {
        ...response,
        subjects: [
          ...response.subjects,
          {
            id: "subject-french",
            name: "Français",
            average: 13.5,
            evaluations: [{
              id: "evaluation-french",
              label: "Dictée",
              date: "2026-10-15",
              type: "scheduled" as const,
              coefficient: 1,
              score: 13.5,
              maxScore: 20,
            }],
          },
        ],
      }
    })

    const queryClient = createQueryClient()
    const view = renderGradesPage(queryClient)
    try {
      const mathematics = await screen.findByRole("button", {
        name: "Notes et évaluations de Mathématiques et sciences appliquées",
      })
      const french = screen.getByRole("button", { name: "Notes et évaluations de Français" })

      fireEvent.click(mathematics)
      expect(mathematics).toHaveAttribute("aria-expanded", "true")
      expect(await screen.findByText("Composition écrite avec un libellé volontairement long")).toBeInTheDocument()

      fireEvent.click(french)
      expect(french).toHaveAttribute("aria-expanded", "true")
      expect(mathematics).toHaveAttribute("aria-expanded", "false")
      expect(screen.queryByText("Composition écrite avec un libellé volontairement long")).not.toBeInTheDocument()
      expect(screen.getByText("Dictée")).toBeInTheDocument()
    } finally {
      view.unmount()
      queryClient.clear()
    }
  })

  it("affiche un lien vers le bulletin publié et permet de fermer son alerte", async () => {
    api.reportCards.mockResolvedValue({
      reportCards: [{
        id: "published-card",
        periodLabel: "Trimestre 1",
        schoolYearId: "year-active",
        schoolYearLabel: "2026-2027",
        generalAverage: 15,
        rank: 2,
        classHeadcount: 20,
        publishedAt: "2026-10-01",
      }],
      availableSchoolYears: [{ id: "year-active", label: "2026-2027" }],
      inRevision: false,
    })
    const queryClient = createQueryClient()
    const view = renderGradesPage(queryClient)
    try {
      expect(await screen.findByText("Le bulletin du Trimestre 1 est disponible.")).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "Consulter le bulletin" })).toHaveAttribute(
        "href",
        "/parent/report-cards?student=aya",
      )
      fireEvent.click(screen.getByRole("button", { name: "Fermer l’alerte du bulletin" }))
      expect(screen.queryByText("Le bulletin du Trimestre 1 est disponible.")).not.toBeInTheDocument()
    } finally {
      view.unmount()
      queryClient.clear()
    }
  })

  it("sépare le cache par enfant et période et réinitialise la période au changement d’enfant", async () => {
    const queryClient = createQueryClient()
    const view = renderGradesPage(queryClient)
    try {
      await screen.findByText("16,25")
      await choose("Période", "Trimestre 1")
      expect(await screen.findByText("Aucun résultat disponible")).toBeInTheDocument()
      expect(api.grades).toHaveBeenCalledWith("aya", "period-t1")

      await choose("Enfant", "KONÉ Yao · 5ème B")
      expect(await screen.findByText("16,25")).toBeInTheDocument()
      expect(api.grades).toHaveBeenCalledWith("yao", undefined)
      expect(queryClient.getQueryData(["parent", "grades", "aya", "period-t1"])).toBeDefined()
      expect(screen.getByRole("combobox", { name: "Période" })).toHaveTextContent("Trimestre 2 · En cours")
    } finally {
      view.unmount()
      queryClient.clear()
    }
  })

  it("distingue les résultats en révision, l’absence de résultat et l’erreur réessayable", async () => {
    api.grades.mockResolvedValue(gradeResponse("period-t2", true, true))
    const partialClient = createQueryClient()
    const partialView = renderGradesPage(partialClient)
    try {
      expect(await screen.findByText("Certains résultats sont en cours de révision par l’établissement.")).toBeInTheDocument()
      expect(screen.getByText("Mathématiques et sciences appliquées")).toBeInTheDocument()
    } finally {
      partialView.unmount()
      partialClient.clear()
    }

    api.grades.mockResolvedValue(gradeResponse("period-t2", false, true))
    const queryClient = createQueryClient()
    const view = renderGradesPage(queryClient)
    try {
      expect(await screen.findByText("Résultats en cours de révision par l’établissement")).toBeInTheDocument()
    } finally {
      view.unmount()
      queryClient.clear()
    }

    api.grades.mockResolvedValue(gradeResponse("period-t2", false, false))
    const emptyClient = createQueryClient()
    const emptyView = renderGradesPage(emptyClient)
    try {
      expect(await screen.findByText("Les évaluations apparaissent ici après la saisie complète des notes. La moyenne de matière s’affiche après validation.")).toBeInTheDocument()
    } finally {
      emptyView.unmount()
      emptyClient.clear()
    }

    api.grades.mockRejectedValue(new Error("offline"))
    const errorClient = createQueryClient()
    const errorView = renderGradesPage(errorClient)
    try {
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger les résultats"))
      expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument()
    } finally {
      errorView.unmount()
      errorClient.clear()
    }
  })
})
