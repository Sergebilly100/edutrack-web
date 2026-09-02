import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

const fetchScope = vi.fn()
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

function renderAcademicPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={["/academic/notes?classId=c1&gradingPeriodId=p1&lessonSlotId=slot1"]}>
      <QueryClientProvider client={queryClient}><NotesPage /></QueryClientProvider>
    </MemoryRouter>,
  )
}

describe("NotesPage", () => {
  it("affiche l'état vide tant qu'aucune classe/période n'est choisie", () => {
    renderWithClient(<NotesPage />)
    expect(screen.getByText("Choisissez une classe et une période")).toBeInTheDocument()
    expect(fetchScope).not.toHaveBeenCalled()
  })

  it("charge le périmètre professeur et expose les trois actions académiques", async () => {
    fetchScope.mockResolvedValue({
      lessonSlots: [{ id: "slot1", dayOfWeek: 1, startTime: "08:00", endTime: "09:00", subjectName: "Mathématiques" }],
      subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
      evaluations: [],
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
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une note spontanée" }))
    expect(screen.getByRole("dialog", { name: "Note spontanée, pendant le cours" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByText("Évaluations programmées")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ouvrir le calcul" })).toBeInTheDocument()
    expect(fetchScope).toHaveBeenCalledWith("c1", "p1")
  })

  it("laisse la saisie ouverte après la date de période tant que le professeur ne lance pas le calcul", async () => {
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
    expect(await screen.findByRole("button", { name: "Clôturer la saisie et calculer" })).toBeEnabled()
  })

  it("incrémente et décrémente les points spontanés sans se limiter à -1 et +1", async () => {
    fetchScope.mockResolvedValue({
      lessonSlots: [{ id: "slot1", dayOfWeek: 1, startTime: "08:00", endTime: "09:00", subjectName: "Mathématiques" }],
      subjects: [{ id: "s1", name: "Mathématiques", coefficient: 4 }],
      evaluations: [],
      completion: [{ subjectId: "s1", subjectName: "Mathématiques", subjectCoefficient: 4, status: "in_progress", completedAt: null, calculationStarted: false, teacher: null }],
    })
    renderAcademicPage()
    await screen.findByText("Évaluations programmées")
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une note spontanée" }))
    fireEvent.click(screen.getByRole("button", { name: "Retirer un point" }))
    expect(screen.getByRole("spinbutton", { name: "Points" })).toHaveValue(-1)
    fireEvent.change(screen.getByRole("spinbutton", { name: "Points" }), { target: { value: "-2" } })
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un point" }))
    expect(screen.getByRole("spinbutton", { name: "Points" })).toHaveValue(-1)
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
})
