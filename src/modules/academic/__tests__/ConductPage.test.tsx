import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const submitBulk = vi.fn().mockResolvedValue({ savedCount: 2 })
const listStudentsMock = vi.fn()
const fetchConductOverview = vi.fn()
vi.mock("@/modules/students/students.api", () => ({
  listStudents: (...args: unknown[]) => listStudentsMock(...args),
}))
const { authState, listClassesMock } = vi.hoisted(() => ({
  authState: { permissions: [] as string[] },
  listClassesMock: vi.fn(),
}))
const fetchTeacherContext = vi.fn().mockResolvedValue({
  classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2026-2027" }],
  gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2026-09-01", endDate: "2026-12-20", isCurrent: true, isCompleted: false }],
})
const fetchConductScope = vi.fn().mockResolvedValue({
  isAvailable: true,
  students: [
    { studentId: "s1", fullName: "Awa Koné", matricule: "A1", input: null },
    { studentId: "s2", fullName: "Yao N'Guessan", matricule: "A2", input: null },
  ],
})

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  })
})

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({
    user: { role: "teacher" },
    permissions: authState.permissions,
  }),
}))

vi.mock("@/modules/academic/academic.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/academic/academic.api")>(
    "@/modules/academic/academic.api",
  )
  return {
    ...actual,
    fetchTeacherAcademicContext: (...args: unknown[]) => fetchTeacherContext(...args),
    fetchTeacherConductScope: (...args: unknown[]) => fetchConductScope(...args),
    fetchConductOverview: (...args: unknown[]) => fetchConductOverview(...args),
    listClasses: (...args: unknown[]) => listClassesMock(...args),
    submitBulkConductInputs: (...args: unknown[]) => submitBulk(...args),
  }
})

import ConductPage from "@/modules/academic/ConductPage"

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
}

describe("ConductPage professeur", () => {
  afterEach(() => {
    authState.permissions = []
    listClassesMock.mockReset()
    listStudentsMock.mockReset()
    fetchConductOverview.mockReset()
  })

  it("charge aussi la deuxième page d’élèves pour la décision finale, avec la limite API de 100", async () => {
    listStudentsMock
      .mockResolvedValueOnce({ data: [{ id: "s1", firstName: "Awa", lastName: "Koné" }], pagination: { page: 1, limit: 100, total: 101, totalPages: 2 } })
      .mockResolvedValueOnce({ data: [{ id: "s101", firstName: "Dernier", lastName: "Élève" }], pagination: { page: 2, limit: 100, total: 101, totalPages: 2 } })
    renderWithClient(<ConductPage view="decision" />)
    fireEvent.click(await screen.findByRole("combobox", { name: "Classe enseignée" }))
    fireEvent.click(await screen.findByRole("option", { name: /6ème A/ }))
    await waitFor(() => expect(listStudentsMock).toHaveBeenCalledTimes(2))
    expect(listStudentsMock).toHaveBeenNthCalledWith(1, { classId: "c1", isActive: true, limit: 100, page: 1 })
    expect(listStudentsMock).toHaveBeenNthCalledWith(2, { classId: "c1", isActive: true, limit: 100, page: 2 })
    fireEvent.click(await screen.findByRole("combobox", { name: "Élève" }))
    expect(await screen.findByRole("option", { name: "Dernier Élève" })).toBeInTheDocument()
  })

  it("permet d’attribuer une même note à tous les élèves sélectionnés", async () => {
    renderWithClient(<ConductPage view="teacher" />)

    fireEvent.click(await screen.findByRole("combobox", { name: /classe/i }))
    fireEvent.click(await screen.findByText(/6ème A/))
    fireEvent.click(screen.getByRole("combobox", { name: /période/i }))
    fireEvent.click(await screen.findByRole("option", { name: "1er trimestre" }))

    fireEvent.click(await screen.findByRole("button", { name: "Sélectionner tous" }))
    fireEvent.change(screen.getByLabelText("Note / 20"), { target: { value: "16" } })
    fireEvent.click(screen.getByRole("button", { name: "Appliquer à la sélection" }))

    await waitFor(() => expect(submitBulk).toHaveBeenCalledWith({
        class_id: "c1",
        student_ids: ["s1", "s2"],
        grading_period_id: "p1",
        note: 16,
        observation: undefined,
      }))
  })

  it("masque la conduite tant que le calcul des moyennes n’est pas activé", async () => {
    fetchConductScope.mockResolvedValueOnce({ isAvailable: false, students: [] })
    renderWithClient(<ConductPage view="teacher" />)

    fireEvent.click(await screen.findByRole("combobox", { name: /classe/i }))
    fireEvent.click(await screen.findByText(/6ème A/))
    fireEvent.click(screen.getByRole("combobox", { name: /période/i }))
    fireEvent.click(await screen.findByRole("option", { name: "1er trimestre" }))

    expect(await screen.findByText("Conduite pas encore ouverte")).toBeInTheDocument()
    expect(screen.queryByText("Attribution en masse")).not.toBeInTheDocument()
  })

  it("verrouille la conduite quand les bulletins rendent la période complète", async () => {
    fetchTeacherContext.mockResolvedValueOnce({
      classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2019-2020" }],
      gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2019-09-01", endDate: "2019-12-20", isCurrent: false, isCompleted: true }],
    })
    renderWithClient(<ConductPage view="teacher" />)

    fireEvent.click(await screen.findByRole("combobox", { name: /classe/i }))
    fireEvent.click(await screen.findByText(/6ème A/))
    fireEvent.click(screen.getByRole("combobox", { name: /période/i }))
    fireEvent.click(await screen.findByRole("option", { name: "1er trimestre" }))

    expect(await screen.findByText("Cette période est consultable, mais les notes de conduite sont verrouillées : elle est finalisée ou pas encore courante.")).toBeInTheDocument()
    expect(screen.queryByText("Attribution en masse")).not.toBeInTheDocument()
  })

  it("n’affiche à un professeur décisionnaire que ses classes enseignées", async () => {
    authState.permissions = ["conduct.finalize"]
    fetchTeacherContext.mockResolvedValueOnce({
      classes: [
        { id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2026-2027" },
        { id: "c2", name: "5ème B", levelId: "l2", levelName: "5ème", schoolYearId: "y1", schoolYearLabel: "2026-2027" },
      ],
      gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2026-09-01", endDate: "2026-12-20", isCurrent: true, isCompleted: false }],
    })

    renderWithClient(<ConductPage view="decision" />)

    fireEvent.click(await screen.findByRole("combobox", { name: "Classe enseignée" }))
    expect(await screen.findByRole("option", { name: /6ème A/ })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /5ème B/ })).toBeInTheDocument()
    expect(listClassesMock).not.toHaveBeenCalled()
  })

  it("liste les professeurs manquants et bloque la décision finale", async () => {
    listStudentsMock.mockResolvedValue({
      data: [{ id: "s1", firstName: "Awa", lastName: "Koné" }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    })
    fetchConductOverview.mockResolvedValue({
      student: { id: "s1", fullName: "Awa Koné", className: "6ème A" },
      gradingPeriod: { id: "p1", label: "1er trimestre" },
      teacherInputs: [
        { id: "i1", teacherId: "t1", teacherName: "Mme Traoré", subjectLabel: "Mathématiques", note: 16, observation: null, createdAt: "2026-09-10", isSubmitted: true },
        { id: null, teacherId: "t2", teacherName: "M. Yao", subjectLabel: "Français", note: null, observation: null, createdAt: null, isSubmitted: false },
      ],
      inputSummary: { expectedCount: 2, submittedCount: 1, isComplete: false },
      spontaneousEvaluations: [],
      finalGrade: null,
    })
    renderWithClient(<ConductPage view="decision" />)

    fireEvent.click(await screen.findByRole("combobox", { name: "Classe enseignée" }))
    fireEvent.click(await screen.findByRole("option", { name: /6ème A/ }))
    fireEvent.click(await screen.findByRole("combobox", { name: "Élève" }))
    fireEvent.click(await screen.findByRole("option", { name: "Awa Koné" }))

    expect(await screen.findByText("1/2 renseignés")).toBeInTheDocument()
    expect(screen.getByText("M. Yao")).toBeInTheDocument()
    expect(screen.getByText("À renseigner")).toBeInTheDocument()
    expect(screen.getByRole("spinbutton", { name: "Note définitive / 20" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Arrêter la note" })).toBeDisabled()
  })
})
