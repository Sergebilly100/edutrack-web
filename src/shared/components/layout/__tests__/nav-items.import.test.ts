import { describe, expect, it } from "vitest"

import { NAV_ITEMS, getNavItemsByRole } from "@/shared/components/layout/nav-items"

describe("menu latéral et imports", () => {
  it("ne propose plus d'entrée « Import de données » (l'import de l'EDT passe par l'emploi du temps)", () => {
    expect(NAV_ITEMS.map((item) => item.label)).not.toContain("Import de données")
    expect(NAV_ITEMS.map((item) => item.href)).not.toContain("/import")
    const director = getNavItemsByRole("director", ["import.schedule", "import.students", "import.teachers"])
    expect(director.map((item) => item.href)).not.toContain("/import")
    expect(director.map((item) => item.href)).toContain("/schedule")
  })
})
