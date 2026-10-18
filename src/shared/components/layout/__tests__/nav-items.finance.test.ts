import { describe, expect, it } from "vitest"

import { getNavItemsByRole } from "../nav-items"
import { FINANCE_PATHS } from "@/modules/finance/finance.routes"

describe("finance navigation", () => {
  it("keeps every finance route reachable in the two labeled sections", () => {
    const financeItems = getNavItemsByRole("director").filter((item) =>
      item.group === "Finance",
    )

    expect(financeItems.map((item) => item.label)).toEqual([
      "Vue financière",
      "Recouvrement détaillé",
      "Journal de caisse",
      "Encaissements",
      "Historique & reçus",
      "Abonnements parents",
      "Revenus abonnements",
    ])
    expect(financeItems.map((item) => item.section)).toEqual([
      "Scolarité",
      "Scolarité",
      "Scolarité",
      "Scolarité",
      "Scolarité",
      "Abonnements",
      "Abonnements",
    ])
    expect(financeItems.map((item) => item.href)).toEqual([
      FINANCE_PATHS.dashboard,
      FINANCE_PATHS.recovery,
      FINANCE_PATHS.journal,
      FINANCE_PATHS.entry,
      FINANCE_PATHS.history,
      "/subscriptions",
      "/subscriptions/revenue",
    ])
  })

  it("uses separate icons for the cash journal and parent subscriptions", () => {
    const financeItems = getNavItemsByRole("director").filter((item) =>
      item.group === "Finance",
    )
    const cashJournal = financeItems.find((item) => item.label === "Journal de caisse")
    const parentSubscriptions = financeItems.find((item) => item.label === "Abonnements parents")

    expect(cashJournal?.icon).toBeDefined()
    expect(parentSubscriptions?.icon).toBeDefined()
    expect(cashJournal?.icon).not.toBe(parentSubscriptions?.icon)
  })
})
