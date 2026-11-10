import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import { getNavItemsByRole, isNavItemActive } from "../nav-items"
import { NavSections } from "../NavSections"
import { useSidebarStore } from "@/shared/store/sidebar.store"

const items = getNavItemsByRole("director", ["payments.view", "payments.record", "tuition.view", "salary.view"] as never[]).filter((item) => item.group === "Finance")

const mount = (path = "/finance/dashboard", badges: Record<string, number> = {}) => render(
  <MemoryRouter initialEntries={[path]}>
    <NavSections
      group="Finance"
      items={items}
      isActive={(item) => isNavItemActive(item, path, "")}
      badgeFor={(item) => ({ count: badges[item.href] })}
      renderItem={(item) => <a href={item.href} aria-current={isNavItemActive(item, path, "") ? "page" : undefined}>{item.label}</a>}
    />
  </MemoryRouter>,
)

describe("sous-groupes du menu Finance", () => {
  beforeEach(() => { localStorage.clear(); useSidebarStore.setState({ expandedGroup: null }) })

  it("donne un titre à chaque sous-groupe (aucune entrée hors sous-groupe) et les referme tous quand aucun n'est actif", () => {
    mount("/autre")
    for (const title of ["Vue d’ensemble", "Encaissement", "Ajustements", "Personnel"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${title}`) })).toBeVisible()
    }
    expect(screen.queryByRole("link", { name: "Journal de caisse" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Accords & ajustements" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Salaires professeurs" })).not.toBeInTheDocument()
  })

  it("révèle les entrées d'un sous-groupe d'une seule entrée au clic", () => {
    mount()
    fireEvent.click(screen.getByRole("button", { name: /^Personnel/ }))
    expect(screen.getByRole("link", { name: "Salaires professeurs" })).toBeVisible()
  })

  it("ouvre automatiquement le sous-groupe de la page active, qui ne peut pas être replié", () => {
    mount("/finance/journal")
    expect(screen.getByRole("link", { name: "Journal de caisse" })).toHaveAttribute("aria-current", "page")
    fireEvent.click(screen.getByRole("button", { name: /^Encaissement/ }))
    expect(screen.getByRole("link", { name: "Journal de caisse" })).toBeVisible()
  })

  it("ne garde ouvert que le sous-groupe actif : les autres se referment dès qu'on change de page", () => {
    const first = mount("/finance/dashboard")
    expect(screen.getByRole("link", { name: "Vue financière" })).toBeVisible()
    expect(screen.queryByRole("link", { name: "Journal de caisse" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Encaissement/ }))
    expect(screen.getByRole("link", { name: "Journal de caisse" })).toBeVisible()
    first.unmount()
    mount("/finance/journal")
    expect(screen.getByRole("link", { name: "Journal de caisse" })).toBeVisible()
    expect(screen.queryByRole("link", { name: "Vue financière" })).not.toBeInTheDocument()
  })

  it("affiche la pastille cumulée sur un sous-groupe replié", () => {
    mount("/finance/dashboard", { [items.find((item) => item.label === "Journal de caisse")!.href]: 2, [items.find((item) => item.label === "Encaissements")!.href]: 1 })
    expect(screen.getByRole("button", { name: /^Encaissement, fermé/ })).toHaveTextContent("3")
  })
})
