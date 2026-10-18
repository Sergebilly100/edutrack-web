import { fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

const getStudentYearResults = vi.hoisted(() => vi.fn())
vi.mock("@/modules/students/students.api", () => ({ getStudentYearResults }))
import { StudentYearResults } from "../components/StudentYearResults"

describe("StudentYearResults", () => {
  it("présente uniquement les notes demandées pour l’année sélectionnée", async () => {
    getStudentYearResults.mockResolvedValue({
      studentId: "student-1", schoolYearId: "year-2025",
      periods: [{ id: "period-1", label: "Trimestre 1", startDate: "2026-09-01", endDate: "2026-10-31", isCurrent: true, isFuture: false }],
      evaluations: [{
        id: "evaluation-1", gradingPeriodId: "period-1", periodLabel: "Trimestre 1",
        subjectName: "Mathématiques", label: "Devoir 1", evaluationDate: "2026-10-05",
        teacherName: "Kouamé Aya", score: 15, maxScore: 20, coefficient: 2,
      }],
      averages: [{ id: "average-1", gradingPeriodId: "period-1", periodLabel: "Trimestre 1", subjectName: null, average: 14, rank: 3 }],
      conduct: [{ id: "conduct-1", gradingPeriodId: "period-1", periodLabel: "Trimestre 1", note: 16, coefficient: 1 }],
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StudentYearResults studentId="student-1" schoolYearId="year-2025" schoolYearLabel="2025-2026" />
    </QueryClientProvider>)
    expect(await screen.findByRole("tab", { name: /Évaluations/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("tab", { name: "Tout" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Réinitialiser les filtres" })).toBeDisabled()
    expect(await screen.findByText("Devoir 1")).toBeInTheDocument()
    expect(screen.getByText(/Le 5 oct/)).toBeInTheDocument()
    expect(screen.getByText(/Professeur Kouamé Aya/)).toBeInTheDocument()
    expect(within(screen.getByRole("tabpanel")).queryByText("Moyenne générale")).not.toBeInTheDocument()
    expect(getStudentYearResults).toHaveBeenCalledWith("student-1", "year-2025")
  })

  it("filtre les résultats par période et matière", async () => {
    getStudentYearResults.mockResolvedValue({
      studentId: "student-1", schoolYearId: "year-2025",
      periods: [
        { id: "period-1", label: "Trimestre 1", startDate: "2026-09-01", endDate: "2026-10-31", isCurrent: true, isFuture: false },
        { id: "period-2", label: "Trimestre 2", startDate: "2026-11-01", endDate: "2027-01-31", isCurrent: false, isFuture: true },
      ],
      evaluations: [
        {
          id: "evaluation-1", gradingPeriodId: "period-1", periodLabel: "Trimestre 1",
          subjectName: "Mathématiques", label: "Devoir 1", evaluationDate: "2026-10-05",
          teacherName: "Kouamé Aya", score: 15, maxScore: 20, coefficient: 2,
        },
        {
          id: "evaluation-2", gradingPeriodId: "period-2", periodLabel: "Trimestre 2",
          subjectName: "Français", label: "Dictée", evaluationDate: "2026-11-06",
          teacherName: "Yao Marc", score: 8, maxScore: 10, coefficient: 1,
        },
      ],
      averages: [
        { id: "average-1", gradingPeriodId: "period-1", periodLabel: "Trimestre 1", subjectName: "Mathématiques", average: 16, rank: 3 },
        { id: "average-2", gradingPeriodId: "period-1", periodLabel: "Trimestre 1", subjectName: null, average: 14, rank: null },
      ],
      conduct: [{ id: "conduct-1", gradingPeriodId: "period-1", periodLabel: "Trimestre 1", note: 16, coefficient: 1 }],
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StudentYearResults studentId="student-1" schoolYearId="year-2025" schoolYearLabel="2025-2026" />
    </QueryClientProvider>)

    expect(await screen.findByText("Devoir 1")).toBeInTheDocument()
    expect(within(screen.getByRole("tabpanel")).getByText("Dictée")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("combobox", { name: "Période" }))
    expect(screen.queryByRole("option", { name: "En cours" })).not.toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Trimestre 1 · En cours" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /Trimestre 2 · À venir/ })).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(screen.getByRole("option", { name: "Trimestre 1 · En cours" }))
    fireEvent.click(screen.getByRole("combobox", { name: "Matière · notes et moyennes" }))
    fireEvent.click(screen.getByRole("option", { name: "Mathématiques" }))

    expect(screen.getByText("Devoir 1")).toBeInTheDocument()
    expect(screen.queryByText("Dictée")).not.toBeInTheDocument()
    expect(within(screen.getByRole("tabpanel")).queryByText("Moyenne générale")).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Moyennes/ }), { button: 0 })
    expect(screen.getByText("Rang : 3e")).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Évaluations/ }), { button: 0 })
    expect(screen.getByRole("tab", { name: /Évaluations/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("tab", { name: "Tout" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Réinitialiser les filtres" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser les filtres" }))
    expect(screen.getByRole("combobox", { name: "Période" })).toHaveTextContent("Toutes les périodes")
    expect(screen.getByRole("combobox", { name: "Matière · notes et moyennes" })).toHaveTextContent("Toutes les matières")
    expect(screen.getByRole("button", { name: "Réinitialiser les filtres" })).toBeDisabled()
    expect(screen.getByText("Dictée")).toBeInTheDocument()
  })
})
