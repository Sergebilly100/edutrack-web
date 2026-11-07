import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BirthPlaceField, IdentityFields, IdentityValue } from "@/shared/components/IdentityFields"
import { EMPTY_IDENTITY, type IdentityFormValues } from "@/shared/lib/identity"

function Harness({ initial = EMPTY_IDENTITY, onValue }: { initial?: IdentityFormValues; onValue?: (value: IdentityFormValues) => void }) {
  const [value, setValue] = useState(initial)
  const change = (next: IdentityFormValues) => { setValue(next); onValue?.(next) }
  return <><BirthPlaceField idPrefix="t" value={value} onChange={change} /><IdentityFields idPrefix="t" value={value} onChange={change} /></>
}

Element.prototype.scrollIntoView = () => {}

describe("IdentityFields", () => {
  it("affiche un état vide valide avec « Non renseigné »", () => {
    render(<Harness />)
    expect(screen.getByLabelText("Sexe")).toHaveTextContent("Non renseigné")
    expect(screen.getByLabelText("Nationalité")).toHaveTextContent("Non renseignée")
    expect(screen.getByLabelText("Lieu de naissance")).toHaveValue("")
  })

  it("choisit puis efface le sexe dans une liste qui se ferme à la sélection", async () => {
    let last = EMPTY_IDENTITY
    render(<Harness onValue={(value) => { last = value }} />)
    fireEvent.keyDown(screen.getByLabelText("Sexe"), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("option", { name: "Féminin" }))
    expect(last.sex).toBe("F")
    expect(screen.queryByRole("option", { name: "Masculin" })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByLabelText("Sexe"), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("option", { name: "Non renseigné" }))
    expect(last.sex).toBe("")
  })

  it("filtre les pays par saisie sans tenir compte des accents et sélectionne par code ISO", async () => {
    let last = EMPTY_IDENTITY
    render(<Harness onValue={(value) => { last = value }} />)
    fireEvent.keyDown(screen.getByLabelText("Nationalité"), { key: "ArrowDown" })
    fireEvent.change(await screen.findByLabelText("Rechercher un pays"), { target: { value: "cote d" } })
    fireEvent.click(await screen.findByRole("option", { name: /Côte d'Ivoire/ }))
    expect(last.nationality).toBe("CI")
    expect(screen.queryByLabelText("Rechercher un pays")).not.toBeInTheDocument()
  })

  it("signale un lieu de naissance trop court sans bloquer la saisie", () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText("Lieu de naissance"), { target: { value: "A" } })
    expect(screen.getByRole("alert")).toHaveTextContent("au moins 2 caractères")
    fireEvent.change(screen.getByLabelText("Lieu de naissance"), { target: { value: "Abidjan" } })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("IdentityValue affiche « Non renseigné » pour une valeur vide", () => {
    render(<><IdentityValue>{null}</IdentityValue><IdentityValue>Bouaké</IdentityValue></>)
    expect(screen.getByText("Non renseigné")).toHaveClass("text-muted-foreground")
    expect(screen.getByText("Bouaké")).toBeInTheDocument()
  })
})
