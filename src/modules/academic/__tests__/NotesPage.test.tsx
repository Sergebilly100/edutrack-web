import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchScope = vi.fn()
const markSubjectCompleted = vi.fn()
const fetchContext = vi.fn().mockResolvedValue({
  classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2026-2027" }],
  gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2026-09-01", endDate: "2026-12-20" }],
})

vi.mock("@/modules/academic/academic.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/academic/academic.api")>(
    "@/modules/academic/academic.api",
  )
  return {
    ...actual,
    fetchTeacherAcademicContext: (...args: unknown[]) => fetchContext(...args),
    fetchEvaluationsScope: (...args: unknown[]) => fetchScope(...args),
    markSubjectCompleted: (...args: unknown[]) => markSubjectCompleted(...args),
  }
})

vi.mock("@/modules/students/students.api", () => ({
  listStudents: vi.fn().mockResolvedValue({ data: [{ id: "student-1", firstName: "Awa", lastName: "Koné" }] }),
}))

vi.mock("@/shared/api/client", () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: { gradingPeriods: [] } }) },
}))

import NotesPage from "@/modules/academic/NotesPage"

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter><QueryClientProvider client={queryClient}>{ui}</QueryClientProvider></MemoryRouter>
  )
}

function renderAcademicPage(path = "/academic/notes?classId=c1&gradingPeriodId=p1&lessonSlotId=slot1") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}><NotesPage /></QueryClientProvider>
    </MemoryRouter>,
  )
}

describe("NotesPage", () => {
  beforeEach(() => {
    fetchScope.mockReset()
    markSubjectCompleted.mockReset()
    markSubjectCompleted.mockResolvedValue({ completion: { status: "in_progress" } })
  })
  it("affiche l'état vide tant qu'aucune classe/période n'est choisie", () => {
    renderWithClient(<NotesPage />)
    expect(screen.getByText("Choisissez une classe et une période")).toBeInTheDocument()
    expect(fetchScope).not.toHaveBeenCalled()
  })

  it("charge le périmètre professeur et permet de programmer une évaluation", async () => {
    fetchScope.mockResolvedValue({
      lessonSlots: [{ id: "slot1", dayOfWeek: 1, startTime: "08:00", endTime: "09:00", subjectName: "Mathématiques" }],
      subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
      evaluations: [{ id: "e1", label: "Devoir 1", type: "scheduled", coefficient: 1, subjectId: "s1", subjectName: "Mathématiques", grades: [{ studentId: "student-1", score: 12, maxScore: 20, comment: null }] }],
      completion: [{ subjectId: "s1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: true, teacher: null }],
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <MemoryRouter initialEntries={["/academic/notes?classId=c1&gradingPeriodId=p1&lessonSlotId=slot1"]}>
        <QueryClientProvider client={queryClient}><NotesPage /></QueryClientProvider>
      </MemoryRouter>,
    )

    await screen.findByText("Évaluations programmées")
    fireEvent.click(screen.getByRole("button", { name: "Programmer une évaluation" }))
    expect(screen.getByLabelText("Date de l’évaluation")).toBeRequired()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByText("Évaluations programmées")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ouvrir le calcul" })).toBeInTheDocument()
    expect(fetchScope).toHaveBeenCalledWith("c1", "p1")
  })

  it("masque le calcul tant qu’aucune note effective n’a été saisie", async () => {
    fetchContext.mockResolvedValueOnce({
      classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2024-2025" }],
      gradingPeriods: [{ id: "p-old", schoolYearId: "y1", label: "1er trimestre", startDate: "2024-09-01", endDate: "2024-12-20" }],
    })
    fetchScope.mockResolvedValue({
      lessonSlots: [{ id: "slot1", dayOfWeek: 1, startTime: "08:00", endTime: "09:00", subjectName: "Mathématiques" }],
      subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
      evaluations: [],
      completion: [{ subjectId: "s1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: false, teacher: null }],
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <MemoryRouter initialEntries={["/academic/notes?classId=c1&gradingPeriodId=p-old"]}>
        <QueryClientProvider client={queryClient}><NotesPage /></QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole("button", { name: "Programmer une évaluation" })).toBeEnabled()
    expect(screen.queryByText("Période terminée")).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Calculer et valider par matière" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Calculer les moyennes" })).not.toBeInTheDocument()
  })

  it("masque aussi le calcul lorsqu’une évaluation existe sans aucune note saisie", async () => {
    fetchScope.mockResolvedValue({
      lessonSlots: [{ id: "slot1", dayOfWeek: 1, startTime: "08:00", endTime: "09:00", subjectName: "Mathématiques" }],
      subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
      evaluations: [{ id: "e1", label: "Devoir 1", type: "scheduled", coefficient: 1, subjectId: "s1", subjectName: "Mathématiques", grades: [] }],
      completion: [{ subjectId: "s1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: false, teacher: null }],
    })
    renderAcademicPage()

    await screen.findByText("Devoir 1")
    expect(screen.queryByRole("heading", { name: "Calculer et valider par matière" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Calculer les moyennes" })).not.toBeInTheDocument()
  })

  it("n’ouvre qu’une grille de notes à la fois", async () => {
    fetchScope.mockResolvedValue({
      lessonSlots: [{ id: "slot1", dayOfWeek: 1, startTime: "08:00", endTime: "09:00", subjectName: "Mathématiques" }],
      subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
      evaluations: [
        { id: "e1", label: "Devoir 1", type: "scheduled", coefficient: 1, subjectId: "s1", subjectName: "Mathématiques", grades: [] },
        { id: "e2", label: "Devoir 2", type: "scheduled", coefficient: 1, subjectId: "s1", subjectName: "Mathématiques", grades: [] },
      ],
      completion: [{ subjectId: "s1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: false, teacher: null }],
    })
    renderAcademicPage()
    await screen.findByText("Devoir 1")
    fireEvent.click(screen.getByRole("button", { name: /Devoir 1/ }))
    expect(screen.getByRole("dialog", { name: "Saisie des notes" })).toBeInTheDocument()
    expect(screen.getByRole("spinbutton", { name: "Note de Awa Koné" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    fireEvent.click(screen.getByRole("button", { name: /Devoir 2/ }))
    expect(screen.getAllByRole("spinbutton", { name: "Note de Awa Koné" })).toHaveLength(1)
  })

  it("verrouille les notes dès que le calcul des moyennes a commencé", async () => {
    fetchScope.mockResolvedValue({
      lessonSlots: [{ id: "slot1", dayOfWeek: 1, startTime: "08:00", endTime: "09:00", subjectName: "Mathématiques" }],
      subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
      evaluations: [{ id: "e1", label: "Devoir 1", type: "scheduled", coefficient: 1, subjectId: "s1", subjectName: "Mathématiques", grades: [{ studentId: "student-1", score: 12, maxScore: 20, comment: null }] }],
      completion: [{ subjectId: "s1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: true, teacher: null }],
    })
    renderAcademicPage()

    fireEvent.click(await screen.findByRole("button", { name: /Devoir 1/ }))
    expect(screen.getByRole("spinbutton", { name: "Note de Awa Koné" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled()
  })

  it("avertit explicitement avant de verrouiller les notes et demande de sélectionner la période suivante", async () => {
    fetchContext.mockResolvedValueOnce({
      classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2026-2027" }],
      gradingPeriods: [
        { id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2026-09-01", endDate: "2026-12-20", isCurrent: true, isCompleted: false },
        { id: "p2", schoolYearId: "y1", label: "2e trimestre", startDate: "2027-01-01", endDate: "2027-03-31", isCurrent: false, isCompleted: false },
      ],
    })
    fetchScope.mockResolvedValue({
      lessonSlots: [],
      subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
      evaluations: [{ id: "e1", label: "Devoir 1", type: "scheduled", coefficient: 1, subjectId: "s1", subjectName: "Mathématiques", grades: [{ studentId: "student-1", score: 12, maxScore: 20, comment: null }] }],
      completion: [{ subjectId: "s1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: false, teacher: null }],
    })
    renderAcademicPage()

    fireEvent.click(await screen.findByRole("button", { name: "Calculer les moyennes" }))
    expect(screen.getByRole("alertdialog", { name: "Passer au calcul des moyennes ?" })).toBeInTheDocument()
    expect(screen.getByText(/ne pourront plus être modifiées/)).toBeInTheDocument()
    expect(screen.getByText(/sélectionnez explicitement 2e trimestre/)).toBeInTheDocument()
    expect(markSubjectCompleted).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Verrouiller et calculer" }))
    await waitFor(() => expect(markSubjectCompleted).toHaveBeenCalledWith({
      classId: "c1",
      subjectId: "s1",
      gradingPeriodId: "p1",
      status: "in_progress",
    }))
  })

  it("permet de programmer une évaluation sans créneau lorsque l’EDT n’est pas configuré", async () => {
    fetchScope.mockResolvedValue({
      lessonSlots: [],
      subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
      evaluations: [],
      completion: [{ subjectId: "s1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: false, teacher: null }],
    })
    renderAcademicPage("/academic/notes?classId=c1&gradingPeriodId=p1")

    fireEvent.click(await screen.findByRole("button", { name: "Programmer une évaluation" }))
    expect(screen.getByText("Aucun créneau - EDT non configuré")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Programmer" })).toBeDisabled()
  })
})
