import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeAll, describe, expect, it, vi } from "vitest"

const submitBulk = vi.fn().mockResolvedValue({ savedCount: 2 })
const fetchTeacherContext = vi.fn().mockResolvedValue({
  classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2026-2027" }],
  gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2026-09-01", endDate: "2026-12-20" }],
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
    permissions: [],
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
  it("permet d’attribuer une même note à tous les élèves sélectionnés", async () => {
    renderWithClient(<ConductPage view="teacher" />)

    fireEvent.click(await screen.findByRole("combobox", { name: /classe/i }))
    fireEvent.click(await screen.findByText(/6ème A/))
    fireEvent.click(screen.getByRole("combobox", { name: /période/i }))
    fireEvent.click(await screen.findByText("1er trimestre"))

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
    fireEvent.click(await screen.findByText("1er trimestre"))

    expect(await screen.findByText("Conduite pas encore ouverte")).toBeInTheDocument()
    expect(screen.queryByText("Attribution en masse")).not.toBeInTheDocument()
  })

  it("verrouille la conduite quand la période est terminée", async () => {
    fetchTeacherContext.mockResolvedValueOnce({
      classes: [{ id: "c1", name: "6ème A", levelId: "l1", levelName: "6ème", schoolYearId: "y1", schoolYearLabel: "2019-2020" }],
      gradingPeriods: [{ id: "p1", schoolYearId: "y1", label: "1er trimestre", startDate: "2019-09-01", endDate: "2019-12-20" }],
    })
    renderWithClient(<ConductPage view="teacher" />)

    fireEvent.click(await screen.findByRole("combobox", { name: /classe/i }))
    fireEvent.click(await screen.findByText(/6ème A/))
    fireEvent.click(screen.getByRole("combobox", { name: /période/i }))
    fireEvent.click(await screen.findByText("1er trimestre"))

    expect(await screen.findByText("Période terminée")).toBeInTheDocument()
    expect(screen.queryByText("Attribution en masse")).not.toBeInTheDocument()
  })
})
