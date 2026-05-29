import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import TeacherForm from "@/modules/teachers/components/TeacherForm"

describe("TeacherForm", () => {
  it("affiche le taux horaire pour un vacataire", () => {
    render(
      <TeacherForm
        initialValues={{
          firstName: "Awa",
          lastName: "Kouamé",
          matricule: null,
          phone: "2250701234567",
          email: null,
          type: "vacataire",
          subjects: ["Maths"],
          hourlyRate: 5000,
          monthlySalary: null,
        }}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByText("Taux horaire (FCFA)")).toBeInTheDocument()
    expect(screen.queryByText("Salaire fixe (FCFA)")).not.toBeInTheDocument()
  })

  it("affiche le salaire fixe pour un permanent", async () => {
    const onSubmit = vi.fn()

    render(
      <TeacherForm
        initialValues={{
          firstName: "Awa",
          lastName: "Kouamé",
          matricule: null,
          phone: "2250701234567",
          email: null,
          type: "permanent",
          subjects: ["Maths"],
          hourlyRate: null,
          monthlySalary: 350000,
        }}
        onSubmit={onSubmit}
      />
    )

    expect(screen.getByText("Salaire fixe (FCFA)")).toBeInTheDocument()
    expect(screen.queryByText("Taux horaire (FCFA)")).not.toBeInTheDocument()

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
        hourlyRate: null,
        monthlySalary: 350000,
      })
    )
  })
})
