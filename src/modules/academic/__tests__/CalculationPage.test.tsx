import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const scopeInProgress = {
  subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
  evaluations: [{ id: "e1", label: "Devoir 1", type: "scheduled", coefficient: 1, subjectId: "s1", subjectName: "Mathématiques", grades: [{ studentId: "student-1", score: 16, maxScore: 20, comment: null }] }],
  completion: [{ subjectId: "s1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: true, teacher: null }],
  periodState: { isClosed: false, notesEntryOpen: true, reviewOpen: false, reason: null },
  preparation: [{ subjectId: "s1", subjectName: "Mathématiques", status: "in_progress", calculationStarted: true, correctionStatus: null, evaluationCount: 1, expectedGrades: 1, enteredGrades: 1, missingGrades: 0, reasons: [], canStartCalculation: false, canRecalculate: true, canFinalize: true }],
}
const fetchScope = vi.fn()
const fetchContext = vi.fn()

vi.mock("@/modules/academic/academic.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/academic/academic.api")>("@/modules/academic/academic.api")
  return {
    ...actual,
    fetchEvaluationsScope: (...args: unknown[]) => fetchScope(...args),
    fetchTeacherAcademicContext: (...args: unknown[]) => fetchContext(...args),
  }
})

vi.mock("@/modules/students/students.api", () => ({
  listStudents: vi.fn().mockResolvedValue({ data: [{ id: "student-1", firstName: "Awa", lastName: "Koné" }] }),
}))

import CalculationPage from "@/modules/academic/CalculationPage"

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<MemoryRouter initialEntries={["/academic/calculation?classId=c1&gradingPeriodId=p1&subjectId=s1"]}><QueryClientProvider client={queryClient}>{ui}</QueryClientProvider></MemoryRouter>)
}

describe("CalculationPage", () => {
  beforeEach(() => {
    fetchScope.mockReset()
    fetchContext.mockReset()
    fetchScope.mockResolvedValue(scopeInProgress)
    fetchContext.mockResolvedValue({
      classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2026-2027", isHomeroomTeacher: false }],
      gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2026-09-01", endDate: "2026-12-20", isCompleted: false, isCurrent: true }],
    })
  })

  it("sépare le contrôle des notes de la consultation des moyennes", async () => {
    renderWithClient(<CalculationPage />)

    expect(await screen.findByText("Notes de Mathématiques")).toBeInTheDocument()
    expect(screen.getByText("1 note")).toBeInTheDocument()
    expect(screen.queryByText("Moyenne / 20")).not.toBeInTheDocument()
    expect(screen.queryByText("Conduite en masse")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Consulter les notes de Awa Koné" }))
    expect(await screen.findByText("Notes de Awa Koné")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    fireEvent.click(screen.getByRole("button", { name: "Voir les moyennes par élève" }))

    expect(await screen.findByText("Moyenne / 20")).toBeInTheDocument()
    expect(screen.getByText("16,00")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Valider mes moyennes de Mathématiques" })).toBeInTheDocument()
  })

  it("ouvre directement les moyennes validées et conserve le détail des notes", async () => {
    fetchScope.mockResolvedValue({ ...scopeInProgress, completion: [{ ...scopeInProgress.completion[0], status: "completed" }], preparation: [{ ...scopeInProgress.preparation[0], status: "completed", canRecalculate: false, canFinalize: false, reasons: ["SUBJECT_COMPLETED"] }] })
    renderWithClient(<CalculationPage />)

    expect(await screen.findByText("Moyenne / 20")).toBeInTheDocument()
    expect(screen.getByText("Cette matière est validée. Les moyennes et le détail des notes restent consultables.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Consulter les notes de Awa Koné" }))
    expect(await screen.findByText("Notes de Awa Koné")).toBeInTheDocument()
  })

  it("ne propose plus de décision de conduite au professeur principal depuis les moyennes", async () => {
    fetchContext.mockResolvedValue({
      classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2026-2027", isHomeroomTeacher: true }],
      gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2026-09-01", endDate: "2026-12-20", isCompleted: false, isCurrent: true }],
    })
    renderWithClient(<CalculationPage />)

    await screen.findByText("Notes de Mathématiques")
    fireEvent.click(screen.getByRole("button", { name: "Voir les moyennes par élève" }))
    expect(await screen.findByText("Moyenne / 20")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Définir la conduite de Awa Koné" })).not.toBeInTheDocument()
  })
})
