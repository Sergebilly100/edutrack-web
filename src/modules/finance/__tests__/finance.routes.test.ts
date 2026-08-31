import { describe, expect, it } from "vitest"

import { FINANCE_PATHS, getFinancePathFromLegacyTab } from "@/modules/finance/finance.routes"

describe("routes Finance", () => {
  it("redirige les anciens onglets vers les écrans dédiés", () => {
    expect(getFinancePathFromLegacyTab("dashboard")).toBe(FINANCE_PATHS.dashboard)
    expect(getFinancePathFromLegacyTab("entry")).toBe(FINANCE_PATHS.entry)
    expect(getFinancePathFromLegacyTab("history")).toBe(FINANCE_PATHS.history)
    expect(getFinancePathFromLegacyTab("journal")).toBe(FINANCE_PATHS.journal)
  })

  it("conserve l'import dans Journal & exports et sécurise les URL inconnues", () => {
    expect(getFinancePathFromLegacyTab("import")).toBe(FINANCE_PATHS.journal)
    expect(getFinancePathFromLegacyTab("unknown")).toBe(FINANCE_PATHS.dashboard)
    expect(getFinancePathFromLegacyTab(null)).toBe(FINANCE_PATHS.dashboard)
  })
})
