import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/shared/hooks/useStudentLabel", () => {
  const customLabels = {
    singular: "Étudiant(e)",
    plural: "Étudiants",
    singularLower: "étudiant(e)",
    pluralLower: "étudiants",
  }
  return {
    useStudentLabel: () => customLabels.singular,
    useStudentLabels: () => customLabels,
  }
})

import { useStudentLabels } from "@/shared/hooks/useStudentLabel"

function LabelConsumer() {
  const labels = useStudentLabels()
  return (
    <div>
      <h1>{labels.plural}</h1>
      <p>{`Liste des ${labels.pluralLower}`}</p>
      <button type="button">{`Ajouter un ${labels.singularLower}`}</button>
    </div>
  )
}

describe("useStudentLabels - custom label override", () => {
  it("propage le label personnalisé d'un tenant supérieur dans une page", () => {
    render(<LabelConsumer />)
    expect(screen.getByRole("heading", { name: "Étudiants" })).toBeInTheDocument()
    expect(screen.getByText("Liste des étudiants")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ajouter un étudiant(e)" })).toBeInTheDocument()
  })
})
