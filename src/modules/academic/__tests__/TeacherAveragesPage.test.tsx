import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchScope = vi.fn()
const markSubjectCompleted = vi.fn()
vi.mock("@/modules/academic/academic.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/academic/academic.api")>("@/modules/academic/academic.api")
  return {
    ...actual,
    fetchTeacherAcademicContext: vi.fn().mockResolvedValue({ classes: [{ id: "c1", name: "6ème A", schoolYearId: "y1" }], gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "T1" }] }),
    fetchEvaluationsScope: (...args: unknown[]) => fetchScope(...args),
    markSubjectCompleted: (...args: unknown[]) => markSubjectCompleted(...args),
  }
})
import TeacherAveragesPage from "@/modules/academic/TeacherAveragesPage"

const state = (overrides: Record<string, unknown> = {}) => ({
  subjectId: "s1", subjectName: "Mathématiques", status: "in_progress", calculationStarted: false, correctionStatus: null,
  evaluationCount: 1, expectedGrades: 2, enteredGrades: 2, missingGrades: 0, reasons: [], canStartCalculation: true, canRecalculate: false, canFinalize: false,
  ...overrides,
})
const scope = (preparation: Array<ReturnType<typeof state>>, isClosed = false) => ({
  periodState: { isClosed, notesEntryOpen: !isClosed, reviewOpen: false, reason: isClosed ? "PERIOD_CLOSED" : null }, preparation,
})
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<MemoryRouter initialEntries={["/academic/notes?tab=moyennes&classId=c1&gradingPeriodId=p1"]}><QueryClientProvider client={client}><Routes><Route path="/academic/notes" element={<TeacherAveragesPage />} /><Route path="/academic/calculation" element={<p>Page de calcul</p>} /></Routes></QueryClientProvider></MemoryRouter>)
}

describe("TeacherAveragesPage", () => {
  beforeEach(() => { fetchScope.mockReset(); markSubjectCompleted.mockReset(); markSubjectCompleted.mockResolvedValue({ completion: { status: "in_progress" } }) })

  it("explique les notes manquantes et bloque le démarrage", async () => {
    fetchScope.mockResolvedValue(scope([state({ enteredGrades: 1, missingGrades: 1, reasons: ["GRADES_INCOMPLETE"], canStartCalculation: false })]))
    renderPage()
    expect(await screen.findByText(/1 note manquante/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Démarrer le calcul/ })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Saisir les notes" })).toHaveAttribute("href", "/academic/notes?tab=evaluations&classId=c1&gradingPeriodId=p1")
  })

  it("démarre une matière prête puis ouvre le calcul détaillé", async () => {
    fetchScope.mockResolvedValue(scope([state()]))
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: /Démarrer le calcul/ }))
    await waitFor(() => expect(markSubjectCompleted).toHaveBeenCalledWith({ classId: "c1", subjectId: "s1", gradingPeriodId: "p1", status: "in_progress" }))
    expect(await screen.findByText("Page de calcul")).toBeInTheDocument()
  })

  it("distingue une matière validée, une correction et une période clôturée", async () => {
    fetchScope.mockResolvedValue(scope([state({ status: "completed", calculationStarted: true, correctionStatus: "corrected", reasons: ["PERIOD_CLOSED", "SUBJECT_COMPLETED"], canStartCalculation: false })], true))
    renderPage()
    expect(await screen.findByText(/Cette classe et cette période sont clôturées/)).toBeInTheDocument()
    expect(screen.getByText("Réclamation : matière revalidée")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Consulter/ })).toHaveAttribute("href", "/academic/calculation?classId=c1&gradingPeriodId=p1&subjectId=s1")
  })
})
