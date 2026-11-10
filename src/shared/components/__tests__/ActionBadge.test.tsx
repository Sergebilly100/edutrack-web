import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ActionBadge } from "../ActionBadge"

describe("ActionBadge", () => {
  it("n'affiche rien à 0", () => {
    const { container } = render(<ActionBadge count={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("annonce le nombre sans détail", () => {
    render(<ActionBadge count={2} />)
    expect(screen.getByLabelText("2 actions à effectuer")).toHaveTextContent("2")
  })

  it("annonce aussi ce qu'il faut faire quand le détail est fourni", () => {
    render(<ActionBadge count={1} details={["Bulletins bloqués : les moyennes de 1 matière ne sont pas validées"]} />)
    const badge = screen.getByLabelText("1 action à effectuer : Bulletins bloqués : les moyennes de 1 matière ne sont pas validées")
    expect(badge).toHaveAttribute("title", "Bulletins bloqués : les moyennes de 1 matière ne sont pas validées")
  })
})
