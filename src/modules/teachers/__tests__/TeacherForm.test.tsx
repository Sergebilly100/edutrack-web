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
    { id: "maths-2", levelId: "level-2", levelName: "2nde", name: "Maths", coefficient: 2 },
    { id: "chem-3", levelId: "level-3", levelName: "3e", name: "Chimie", coefficient: 2 },
  ]),
  listClasses: vi.fn().mockResolvedValue({
    schoolYear: null,
    activeSchoolYear: { id: "year-1" },
    classes: [
      { id: "2c", name: "2nde C", studentCount: 0, isActive: true, level: { id: "level-2", name: "2nde" }, schoolYear: { id: "year-1" }, homeroomTeacher: null },
      { id: "3b", name: "3e B", studentCount: 0, isActive: true, level: { id: "level-3", name: "3e" }, schoolYear: { id: "year-1" }, homeroomTeacher: null },
      {
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
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Matière du bloc 1" })).toBeEnabled())
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
    await waitFor(() => expect(screen.getByRole("button", { name: "Modifier les classes du bloc 1" })).toBeEnabled())

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

const teacherValues = {
  firstName: "Awa", lastName: "Kouamé", matricule: "P-001", phone: "2250701234567", email: null,
  type: "vacataire" as const, subjects: ["Maths", "Chimie"], hourlyRate: 5000, monthlySalary: null,
  teachingAssignments: [{ subjectId: "subject-maths", classId: "class-6e-a" }, { subjectId: "maths-2", classId: "2c" }, { subjectId: "chem-3", classId: "3b" }],
}
describe("C10 formulaire par blocs", () => {
  it("restaure les groupes multi-niveaux et envoie uniquement les associations explicites", async () => {
    const onSubmit = vi.fn()
    renderTeacherForm(<TeacherForm initialValues={teacherValues} onSubmit={onSubmit} />)
    await screen.findByRole("combobox", { name: "Matière du bloc 2" })
    expect(screen.getByRole("combobox", { name: "Matière du bloc 1" })).toHaveTextContent("Maths")
    expect(screen.getByRole("combobox", { name: "Matière du bloc 2" })).toHaveTextContent("Chimie")
    expect(screen.getByText(/Rappel : classes sans professeur principal/)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ teachingAssignments: teacherValues.teachingAssignments })))
  })
  it("ajoute et supprime des blocs indépendants, et refuse les blocs incomplets", async () => {
    const onSubmit = vi.fn()
    renderTeacherForm(<TeacherForm initialValues={teacherValues} onSubmit={onSubmit} />)
    await screen.findByRole("combobox", { name: "Matière du bloc 2" })
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un bloc" }))
    expect(screen.getByRole("combobox", { name: "Matière du bloc 3" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    await screen.findByText("Choisissez une matière")
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le bloc 3" }))
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le bloc 2" }))
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ teachingAssignments: teacherValues.teachingAssignments.slice(0, 2) })))
  })
  it("accepte un profil sans affectation", async () => {
    const onSubmit = vi.fn()
    renderTeacherForm(<TeacherForm initialValues={{ ...teacherValues, subjects: [], teachingAssignments: [] }} onSubmit={onSubmit} />)
    await waitFor(() => expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ subjects: [], teachingAssignments: [] })))
  })
  it.each([{ isBlocked: true }, { isActive: false }])("verrouille les affectations mais conserve l’édition du profil : %j", async (state) => {
    const onSubmit = vi.fn()
    renderTeacherForm(<TeacherForm initialValues={{ ...teacherValues, ...state }} onSubmit={onSubmit} />)
    await screen.findByRole("combobox", { name: "Matière du bloc 2" })
    expect(screen.getByRole("button", { name: "Ajouter un bloc" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("teachingAssignments")
  })
})
