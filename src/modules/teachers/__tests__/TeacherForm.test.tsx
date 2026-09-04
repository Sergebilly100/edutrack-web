import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"

import TeacherForm from "@/modules/teachers/components/TeacherForm"

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

vi.mock("@/modules/academic/academic.api", () => ({
  listSubjects: vi.fn().mockResolvedValue([
    { id: "subject-maths", levelId: "level-6e", levelName: "6e", name: "Maths", coefficient: 2 },
  ]),
  listClasses: vi.fn().mockResolvedValue({
    schoolYear: null,
    activeSchoolYear: null,
    classes: [{
      id: "class-6e-a",
      name: "6e A",
      studentCount: 28,
      isActive: true,
      level: { id: "level-6e", name: "6e", orderIndex: 1 },
      schoolYear: { id: "year-1", label: "2026-2027" },
      homeroomTeacher: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    }],
  }),
}))

function renderTeacherForm(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("TeacherForm", () => {
  it("affiche le taux horaire pour un vacataire", async () => {
    renderTeacherForm(
      <TeacherForm
        initialValues={{
          firstName: "Awa",
          lastName: "Kouamé",
          matricule: null,
          phone: "2250701234567",
          email: null,
          type: "vacataire",
          subjects: ["Maths"],
          teachingAssignments: [{ subjectId: "subject-maths", classId: "class-6e-a" }],
          hourlyRate: 5000,
          monthlySalary: null,
        }}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByText("Taux horaire (FCFA)")).toBeInTheDocument()
    expect(screen.queryByText("Salaire fixe (FCFA)")).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Modifier les matières" })).toBeEnabled())
  })

  it("affiche le salaire fixe pour un permanent", async () => {
    const onSubmit = vi.fn()

    renderTeacherForm(
      <TeacherForm
        initialValues={{
          firstName: "Awa",
          lastName: "Kouamé",
          matricule: null,
          phone: "2250701234567",
          email: null,
          type: "permanent",
          subjects: ["Maths"],
          teachingAssignments: [{ subjectId: "subject-maths", classId: "class-6e-a" }],
          hourlyRate: null,
          monthlySalary: 350000,
        }}
        onSubmit={onSubmit}
      />
    )

    expect(screen.getByText("Salaire fixe (FCFA)")).toBeInTheDocument()
    expect(screen.queryByText("Taux horaire (FCFA)")).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Modifier les classes" })).toBeEnabled())

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        firstName: "Awa",
        lastName: "Kouamé",
        matricule: null,
        phone: "2250701234567",
        email: null,
        type: "permanent",
        subjects: ["Maths"],
        teachingAssignments: [{ subjectId: "subject-maths", classId: "class-6e-a" }],
        hourlyRate: null,
        monthlySalary: 350000,
      })
    )
  })
})
