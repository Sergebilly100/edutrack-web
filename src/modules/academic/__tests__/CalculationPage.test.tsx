import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const scopeInProgress = {
  subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
  evaluations: [{ id: "e1", label: "Devoir 1", type: "scheduled", coefficient: 1, subjectId: "s1", subjectName: "Mathématiques", grades: [{ studentId: "student-1", score: 16, maxScore: 20, comment: null }] }],
  completion: [{ subjectId: "s1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: true, teacher: null }],
}
const fetchScope = vi.fn()
const fetchContext = vi.fn()
const fetchConductOverview = vi.fn()
const decideConductGrade = vi.fn()

vi.mock("@/modules/academic/academic.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/academic/academic.api")>("@/modules/academic/academic.api")
  return {
    ...actual,
    fetchEvaluationsScope: (...args: unknown[]) => fetchScope(...args),
    fetchTeacherAcademicContext: (...args: unknown[]) => fetchContext(...args),
    fetchTeacherConductScope: vi.fn().mockResolvedValue({ isAvailable: true, students: [] }),
    fetchConductOverview: (...args: unknown[]) => fetchConductOverview(...args),
    decideConductGrade: (...args: unknown[]) => decideConductGrade(...args),
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
    fetchConductOverview.mockReset()
    decideConductGrade.mockReset()
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
    fireEvent.click(screen.getByRole("button", { name: "Consulter" }))
    expect(await screen.findByText("Notes de Awa Koné")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    fireEvent.click(screen.getByRole("button", { name: "Voir les moyennes par élève" }))

    expect(await screen.findByText("Moyenne / 20")).toBeInTheDocument()
    expect(screen.getByText("16,00")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Valider mes moyennes de Mathématiques" })).toBeInTheDocument()
  })

  it("ouvre directement les moyennes validées et conserve le détail des notes", async () => {
    fetchScope.mockResolvedValue({ ...scopeInProgress, completion: [{ ...scopeInProgress.completion[0], status: "completed" }] })
    renderWithClient(<CalculationPage />)

    expect(await screen.findByText("Moyenne / 20")).toBeInTheDocument()
    expect(screen.getByText("Cette matière est validée. Les moyennes et le détail des notes restent consultables.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Notes" }))
    expect(await screen.findByText("Notes de Awa Koné")).toBeInTheDocument()
  })

  it("permet au professeur principal de consulter les avis et d’enregistrer la conduite finale", async () => {
    fetchContext.mockResolvedValue({
      classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2026-2027", isHomeroomTeacher: true }],
      gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2026-09-01", endDate: "2026-12-20", isCompleted: false, isCurrent: true }],
    })
    fetchConductOverview.mockResolvedValue({
      student: { id: "student-1", displayName: "Awa Koné", className: "6ème A" },
      teacherInputs: [{ id: "input-1", teacherName: "Mme Traoré", note: 17, subjectLabel: "Mathématiques", observation: "Très impliquée", createdAt: "2026-09-10" }],
      finalGrade: null,
    })
    decideConductGrade.mockResolvedValue({ note: 18 })
    renderWithClient(<CalculationPage />)

    await screen.findByText("Notes de Mathématiques")
    fireEvent.click(screen.getByRole("button", { name: "Voir les moyennes par élève" }))
    fireEvent.click(await screen.findByRole("button", { name: "Définir" }))
    expect(await screen.findByText("Avis des enseignants")).toBeInTheDocument()
    expect(screen.getByText("Mme Traoré · 17/20")).toBeInTheDocument()
    fireEvent.change(screen.getByRole("spinbutton", { name: "Note finale / 20" }), { target: { value: "18" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la note finale" }))
    await waitFor(() => expect(decideConductGrade).toHaveBeenCalledWith({ student_id: "student-1", grading_period_id: "p1", note: 18 }))
  })
})
