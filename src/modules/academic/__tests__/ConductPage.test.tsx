import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const submitBulk = vi.fn().mockResolvedValue({ savedCount: 2 })
const fetchDecisionStudents = vi.fn().mockResolvedValue({ students: [{ id: "s1", fullName: "Awa Koné" }] })
const fetchDecisionContext = vi.fn().mockResolvedValue({
  classes: [{ id: "c1", name: "6ème A", schoolYearId: "y1" }],
  gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", conductReviewOpen: true, closedClassIds: [] }],
})
const fetchConductOverview = vi.fn()
const { authState, listClassesMock } = vi.hoisted(() => ({
  authState: { permissions: [] as string[] },
  listClassesMock: vi.fn(),
}))
const fetchTeacherContext = vi.fn().mockResolvedValue({
  classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2026-2027" }],
  gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2026-09-01", endDate: "2026-12-20", isCurrent: true, isCompleted: false, conductReviewOpen: true, closedClassIds: [] }],
})
const fetchConductScope = vi.fn().mockResolvedValue({
  isAvailable: true,
  students: [
    { studentId: "s1", fullName: "Awa Koné", matricule: "A1", input: null, isLocked: false },
    { studentId: "s2", fullName: "Yao N'Guessan", matricule: "A2", input: null, isLocked: false },
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
    fetchConductDecisionContext: (...args: unknown[]) => fetchDecisionContext(...args),
    fetchConductDecisionStudents: (...args: unknown[]) => fetchDecisionStudents(...args),
    fetchTeacherConductScope: (...args: unknown[]) => fetchConductScope(...args),
    fetchConductOverview: (...args: unknown[]) => fetchConductOverview(...args),
    listClasses: (...args: unknown[]) => listClassesMock(...args),
    submitBulkConductInputs: (...args: unknown[]) => submitBulk(...args),
  }
})

import ConductPage from "@/modules/academic/ConductPage"

const openScope = { classId: "c1", className: "6ème A", gradingPeriodId: "p1", gradingPeriodLabel: "1er trimestre", endDate: "2026-12-20", pendingCount: 2 }

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
    fetchTeacherContext.mockClear()
    listClassesMock.mockReset()
    fetchDecisionStudents.mockClear()
    fetchConductOverview.mockReset()
  })

  it("permet d’attribuer une même note à tous les élèves sélectionnés", async () => {
    renderWithClient(<ConductPage openScopes={[openScope]} />)

    fireEvent.click(await screen.findByRole("checkbox", { name: "Sélectionner tous les élèves" }))
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

  it("signale une revue de conduite indisponible", async () => {
    fetchConductScope.mockResolvedValueOnce({ isAvailable: false, students: [] })
    renderWithClient(<ConductPage openScopes={[openScope]} />)

    expect(await screen.findByText("Revue de conduite indisponible")).toBeInTheDocument()
    expect(screen.queryByText("Attribution en masse")).not.toBeInTheDocument()
  })

  it("verrouille un élève dont la note finale est arrêtée", async () => {
    fetchConductScope.mockResolvedValueOnce({ isAvailable: true, students: [
      { studentId: "s1", fullName: "Awa Koné", input: { note: 16, observation: null, createdAt: "" }, isLocked: true },
    ] })
    renderWithClient(<ConductPage openScopes={[openScope]} />)
    expect(await screen.findByText("Awa Koné")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Corriger" })).toBeDisabled()
    expect(screen.queryByText("Attribution en masse")).not.toBeInTheDocument()
  })

  it("n'offre aucune période quand la fenêtre expire", () => {
    renderWithClient(<ConductPage openScopes={[]} />)
    expect(screen.getByText("Fenêtre de revue terminée")).toBeInTheDocument()
    expect(screen.queryByText("Attribution en masse")).not.toBeInTheDocument()
  })

  it("ne propose dans le sélecteur que la période ouverte fournie par l’API", async () => {
    renderWithClient(<ConductPage openScopes={[openScope]} />)
    fireEvent.click(screen.getByRole("combobox", { name: "Période" }))
    expect(await screen.findAllByRole("option")).toHaveLength(1)
    expect(screen.getByRole("option", { name: "1er trimestre" })).toBeInTheDocument()
    expect(fetchTeacherContext).not.toHaveBeenCalled()
  })

  it("laisse les corrections accessibles quand aucun avis ne manque", async () => {
    renderWithClient(<ConductPage openScopes={[{ ...openScope, pendingCount: 0 }]} />)
    expect(screen.getByText(/Aucun avis restant à renseigner/)).toBeInTheDocument()
    expect(screen.getByText(/Revue ouverte jusqu’au 20 décembre 2026/)).toBeInTheDocument()
    expect(await screen.findAllByRole("button", { name: "Enregistrer" })).toHaveLength(2)
  })


})
