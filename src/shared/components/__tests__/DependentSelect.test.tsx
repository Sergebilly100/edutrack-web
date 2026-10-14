import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DependentSelect } from "../DependentSelect"

const levels = [{ id: "level-1", label: "Collège" }]
const classes = [{ id: "class-1", label: "6ème A" }]

function Cascade() {
  const [level, setLevel] = useState("")
  const [classId, setClassId] = useState("")
  return <>
    <DependentSelect id="level" label="Niveau" value={level} options={levels}
      dependsOn={{ field: "year", value: "year-1" }} allLabel="Tous les niveaux"
      onValueChange={(value) => { setLevel(value); setClassId("") }} />
    <DependentSelect id="class" label="Classe" value={classId} options={classes}
      dependsOn={{ field: "level", value: level }} allLabel="Toutes les classes"
      onValueChange={setClassId} />
  </>
}

describe("DependentSelect", () => {
  it("explique toujours la désactivation avec le dictionnaire central", () => {
    render(<DependentSelect id="year-dependent" label="Classe" value="" options={classes}
      dependsOn={{ field: "year", value: "" }} allLabel="Toutes les classes" onValueChange={() => {}} />)
    const control = screen.getByRole("combobox", { name: "Classe" })
    expect(control).toBeDisabled()
    expect(control).toHaveAccessibleDescription("Choisissez une année précise.")
  })

  it("active l'aval et le réinitialise quand l'amont change", () => {
    render(<Cascade />)
    const level = screen.getByRole("combobox", { name: "Niveau" })
    const classControl = screen.getByRole("combobox", { name: "Classe" })
    expect(classControl).toBeDisabled()
    expect(classControl).toHaveAccessibleDescription("Choisissez d'abord un niveau.")
    fireEvent.click(level)
    fireEvent.click(screen.getByRole("option", { name: "Collège" }))
    expect(classControl).toBeEnabled()
    fireEvent.click(classControl)
    fireEvent.click(screen.getByRole("option", { name: "6ème A" }))
    expect(classControl).toHaveTextContent("6ème A")
    fireEvent.click(level)
    fireEvent.click(screen.getByRole("option", { name: "Tous les niveaux" }))
    expect(classControl).toBeDisabled()
    expect(classControl).toHaveTextContent("Toutes les classes")
  })
})
