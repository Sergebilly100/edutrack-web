import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useAuthStore, type AuthUser } from "@/shared/store/auth.store"
import { useAideStore } from "../aide.store"
import { AideButton } from "../AideButton"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { aideKey } from "../aide-storage"

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: (key: string) => ["students.view", "attendance.view"].includes(key),
    refreshPermissions: vi.fn(),
  }),
}))

const user = { id: "u1", tenantId: "t1", role: "director", name: "Test" } as unknown as AuthUser

function Page({ withTour = false }: { withTour?: boolean }) {
  const tour = useTourGuide("students", withTour)
  return <><AideButton /><output data-testid="tour-run">{String(tour.run)}</output></>
}

const renderAt = (path: string, ui = <Page />) => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>)

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ user })
  useAideStore.setState({ tours: [], tourRequest: null, panelOpen: false, revision: 0 })
})
afterEach(() => cleanup())

describe("bouton Aide", () => {
  it("est absent quand la page n'a ni aide ni visite", () => {
    renderAt("/inconnue")
    expect(screen.queryByRole("button", { name: "Ouvrir l'aide de la page" })).toBeNull()
  })

  it("est absent hors Router", () => {
    render(<AideButton />)
    expect(screen.queryByRole("button", { name: "Ouvrir l'aide de la page" })).toBeNull()
  })

  it("affiche la pastille « nouveau » jusqu'à la première ouverture, quelle que soit la sortie", () => {
    renderAt("/students")
    const button = screen.getByRole("button", { name: "Ouvrir l'aide de la page" })
    expect(within(button).getByText("nouveau")).toBeInTheDocument()
    fireEvent.click(button)
    expect(within(button).queryByText("nouveau")).toBeNull()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    expect(within(button).queryByText("nouveau")).toBeNull()
    expect(localStorage.getItem(aideKey({ tenantId: "t1", userId: "u1" }, "students"))).toBe("1")
  })

  it("n'affiche pas la pastille si l'ancienne clé de visite est déjà posée (migration)", () => {
    localStorage.setItem("ivoiredu-tour-done-students", "1")
    renderAt("/students")
    expect(within(screen.getByRole("button", { name: "Ouvrir l'aide de la page" })).queryByText("nouveau")).toBeNull()
  })

  it("garde des pastilles séparées par utilisateur", () => {
    localStorage.setItem(aideKey({ tenantId: "t1", userId: "autre" }, "students"), "1")
    renderAt("/students")
    expect(within(screen.getByRole("button", { name: "Ouvrir l'aide de la page" })).getByText("nouveau")).toBeInTheDocument()
  })

  it("ouvre le panneau avec les trois blocs", () => {
    renderAt("/students")
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'aide de la page" }))
    const panel = screen.getByRole("dialog")
    expect(within(panel).getByText("À quoi sert cette page")).toBeInTheDocument()
    expect(within(panel).getByText("Comment faire")).toBeInTheDocument()
    expect(within(panel).getByText("Bon à savoir")).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Fermer" })).toBeInTheDocument()
    expect(within(panel).getByRole("link", { name: "Toute l'aide" })).toHaveAttribute("href", "/aide")
  })

  it("remplace une tâche interdite par une ligne neutre", () => {
    renderAt("/students")
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'aide de la page" }))
    const panel = screen.getByRole("dialog")
    expect(within(panel).getByRole("button", { name: "Comment retrouver un élève ?" })).toBeInTheDocument()
    expect(within(panel).queryByRole("button", { name: "Comment ajouter un nouvel élève ?" })).toBeNull()
    expect(within(panel).getByText(/Réservé à la direction et aux personnes qui gèrent les inscriptions/)).toBeInTheDocument()
  })

  it("ouvre l'aide avec « ? » mais pas pendant une saisie", () => {
    renderAt("/students")
    fireEvent.keyDown(document.body, { key: "?" })
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    cleanup()
    useAideStore.setState({ panelOpen: false })
    render(<MemoryRouter initialEntries={["/students"]}><Page /><input aria-label="champ" /></MemoryRouter>)
    fireEvent.keyDown(screen.getByLabelText("champ"), { key: "?" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("lance la visite depuis le panneau, sans démarrage automatique", () => {
    vi.useFakeTimers()
    try {
      renderAt("/students", <Page withTour />)
      act(() => { vi.advanceTimersByTime(3000) })
      expect(screen.getByTestId("tour-run").textContent).toBe("false")
      fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'aide de la page" }))
      fireEvent.click(screen.getByRole("button", { name: "Visite guidée de la page" }))
      act(() => { vi.advanceTimersByTime(300) })
      expect(screen.getByTestId("tour-run").textContent).toBe("true")
    } finally {
      vi.useRealTimers()
    }
  })

  it("propose la visite seule sur une page qui n'a qu'une visite", () => {
    useAideStore.setState({ tours: ["teachers"] })
    renderAt("/teachers", <AideButton />)
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'aide de la page" }))
    expect(screen.getByRole("button", { name: "Visite guidée de la page" })).toBeInTheDocument()
  })

  it("masque durablement la pastille via l'option du panneau", () => {
    renderAt("/students")
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'aide de la page" }))
    fireEvent.click(screen.getByRole("switch", { name: /Ne plus afficher la pastille/ }))
    cleanup()
    renderAt("/students")
    expect(within(screen.getByRole("button", { name: "Ouvrir l'aide de la page" })).queryByText("nouveau")).toBeNull()
  })
})
