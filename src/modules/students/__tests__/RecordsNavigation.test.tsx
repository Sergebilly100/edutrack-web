import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const access = vi.hoisted(() => ({ permissions: [] as string[] }))
vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: (key: string) => access.permissions.includes(key) }),
}))
vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) => selector({ user: { role: "staff" } }),
}))

import { RecordsNavigation } from "../components/RecordsNavigation"

describe("navigation Inscriptions & dossiers", () => {
  beforeEach(() => { access.permissions = [] })

  it("ne propose que les dossiers élèves avec students.view", () => {
    access.permissions = ["students.view"]
    render(<MemoryRouter initialEntries={["/records"]}><RecordsNavigation /></MemoryRouter>)
    expect(screen.getByRole("link", { name: "Dossiers élèves" })).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("link", { name: "Inscriptions" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Réinscriptions" })).not.toBeInTheDocument()
  })

  it("ne propose que les inscriptions avec enrollments.view", () => {
    access.permissions = ["enrollments.view"]
    render(<MemoryRouter initialEntries={["/enrollments"]}><RecordsNavigation /></MemoryRouter>)
    expect(screen.queryByRole("link", { name: "Dossiers élèves" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Inscriptions" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Réinscriptions" })).toBeInTheDocument()
  })

  it("met en évidence la campagne sans masquer les deux autres accès", () => {
    access.permissions = ["students.view", "enrollments.view"]
    render(<MemoryRouter initialEntries={["/enrollments?tab=re-enrollment"]}><RecordsNavigation /></MemoryRouter>)
    expect(screen.getByRole("link", { name: "Dossiers élèves" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Inscriptions" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Réinscriptions" })).toHaveAttribute("aria-current", "page")
  })
})
