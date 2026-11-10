import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { formatDateTimeFr } from "@/shared/utils/formatting"
import { HeaderAction, PageHeader } from "../PageHeader"

const renderHeader = (withNote: boolean) =>
  render(
    <MemoryRouter>
      <PageHeader
        title="Gestion des salaires"
        subtitle="Pilotage mensuel"
        actions={
          <>
            <button type="button">Export</button>
            <HeaderAction note={withNote ? "Dernier calcul : 9 nov. 2026 à 14:30" : undefined}>
              <button type="button">Calculer</button>
            </HeaderAction>
          </>
        }
      />
    </MemoryRouter>
  )

describe("PageHeader", () => {
  it("garde l'ordre du DOM des actions et un seul h1", () => {
    renderHeader(true)
    expect(screen.getByRole("heading", { level: 1, name: "Gestion des salaires" })).toBeInTheDocument()
    const buttons = screen.getAllByRole("button").map((button) => button.textContent)
    expect(buttons.indexOf("Export")).toBeLessThan(buttons.indexOf("Calculer"))
  })

  it("place la mention hors du bouton : le bouton ne la contient pas et reste identique avec ou sans mention", () => {
    const { unmount } = renderHeader(true)
    const withNote = screen.getByRole("button", { name: "Calculer" })
    expect(withNote.textContent).toBe("Calculer")
    expect(withNote.className).toBe("")
    const note = screen.getByText(/Dernier calcul/)
    expect(withNote.contains(note)).toBe(false)
    // Bureau : positionnée de façon absolue (hors flux) sous le bord droit du bouton ; étroit : ligne sous toutes les actions.
    expect(note.className).toContain("lg:absolute")
    expect(note.className).toContain("lg:right-0")
    expect(note.className).toContain("basis-full")
    unmount()
    renderHeader(false)
    expect(screen.getByRole("button", { name: "Calculer" }).className).toBe("")
    expect(screen.queryByText(/Dernier calcul/)).not.toBeInTheDocument()
  })

  it("marque la mention et garde le bandeau teinté officiel", () => {
    const { container } = renderHeader(true)
    const header = container.querySelector("header")!
    expect(within(header).getByText(/Dernier calcul/)).toHaveAttribute("data-header-note")
    expect(header.className).toContain("surface-chrome")
    expect(header.className).not.toContain("pb-9")
  })
})

describe("formatDateTimeFr", () => {
  it("formate « 9 nov. 2026 à 14:30 » et omet l'heure sur demande", () => {
    expect(formatDateTimeFr("2026-11-09T14:30:00Z")).toMatch(/^9 nov\.? 2026 à 14:30$/)
    expect(formatDateTimeFr("2026-11-09T14:30:00Z", { withTime: false })).toMatch(/^9 nov\.? 2026$/)
    expect(formatDateTimeFr("pas une date")).toBe("")
  })
})
