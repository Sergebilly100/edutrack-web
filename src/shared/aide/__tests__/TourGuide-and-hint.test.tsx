import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TourGuide } from "@/shared/components/TourGuide"
import { useAuthStore, type AuthUser } from "@/shared/store/auth.store"
import AideCenterPage from "@/modules/aide/AideCenterPage"
import type { AideStep } from "../aide.types"
import { HelpHint } from "../HelpHint"

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: (key: string) => key === "students.view", refreshPermissions: vi.fn() }),
}))

const user = { id: "u1", tenantId: "t1", role: "director", name: "Test" } as unknown as AuthUser
beforeEach(() => useAuthStore.setState({ user }))
afterEach(() => { cleanup(); document.body.replaceChildren() })

const steps: AideStep[] = [
  { target: "[data-tour='present']", title: "Présent", content: "Étape présente", skipBeacon: true },
  { target: "[data-tour='absent']", title: "Absent", content: "Cible absente" },
  { target: "[data-tour='interdit']", title: "Interdit", content: "Autre rôle", roles: ["teacher"] },
]

describe("TourGuide", () => {
  it("retire les étapes sans cible ou interdites avant le démarrage : le compteur reste juste", async () => {
    render(
      <>
        <div data-tour="present">cible</div>
        <div data-tour="interdit">cible 2</div>
        <TourGuide steps={steps} run stepIndex={0} onStepChange={vi.fn()} onFinish={vi.fn()} />
      </>
    )
    expect(await screen.findByText("Étape 1 sur 1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Fermer la visite" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Terminer la visite" })).toBeInTheDocument()
  })

  it("ferme la visite par la croix et rend la main à la page", async () => {
    const onFinish = vi.fn()
    render(
      <>
        <div data-tour="present">cible</div>
        <TourGuide steps={steps} run stepIndex={0} onStepChange={vi.fn()} onFinish={onFinish} />
      </>
    )
    fireEvent.click(await screen.findByRole("button", { name: "Fermer la visite" }))
    expect(onFinish).toHaveBeenCalled()
  })

  it("se termine d'elle-même si aucune étape n'est affichable", () => {
    const onFinish = vi.fn()
    render(<TourGuide steps={steps} run stepIndex={0} onStepChange={vi.fn()} onFinish={onFinish} />)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})

describe("HelpHint", () => {
  it("affiche l'explication au clic, avec un nom accessible", async () => {
    render(<HelpHint term="Impayé">Somme due et non encore réglée.</HelpHint>)
    const trigger = screen.getByRole("button", { name: "Explication : Impayé" })
    expect(trigger.className).toContain("h-12")
    fireEvent.click(trigger)
    expect(await screen.findByText("Somme due et non encore réglée.")).toBeInTheDocument()
  })
})

describe("Centre d'aide", () => {
  it("liste les aides autorisées par espace et filtre par recherche", () => {
    render(<MemoryRouter><AideCenterPage /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "Vie scolaire" })).toBeInTheDocument()
    const hrefs = screen.getAllByRole("link", { name: "Ouvrir la page" }).map((link) => link.getAttribute("href"))
    expect(hrefs).toContain("/students")
    expect(hrefs).toContain("/students/history")
    expect(hrefs).not.toContain("/enrollments")
    expect(hrefs.some((href) => href?.includes(":"))).toBe(false)
    fireEvent.change(screen.getByLabelText("Que voulez-vous faire ?"), { target: { value: "zzzintrouvable" } })
    expect(screen.getByText("Aucune aide trouvée")).toBeInTheDocument()
  })
})
