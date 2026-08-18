import { describe, expect, it } from "vitest"

import { getNavItemsByRole } from "@/shared/components/layout/nav-items"

describe("navigation de la structure scolaire", () => {
  it("est visible pour un staff autorisé aux classes", () => {
    const items = getNavItemsByRole("staff", ["classes.view"])
    expect(items).toEqual(expect.arrayContaining([expect.objectContaining({ href: "/academic" })]))
  })

  it("reste masquée pour un staff sans permission académique", () => {
    const items = getNavItemsByRole("staff", ["students.view"])
    expect(items).not.toEqual(expect.arrayContaining([expect.objectContaining({ href: "/academic" })]))
  })
})
