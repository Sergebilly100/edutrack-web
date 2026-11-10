import { describe, expect, it } from "vitest"

import { filterNavItemsByFeatures, getNavItemsByRole, toNavBlocks } from "../nav-items"
import { FINANCE_PATHS } from "@/modules/finance/finance.routes"

const FINANCE_PERMISSIONS = ["payments.view", "payments.record", "tuition.view", "salary.view", "subscriptions.view", "subscriptions.revenue"] as never[]
const features = { subscriptionsEnabled: true, endOfYearReviewVisible: false }
const groupsOf = (items: ReturnType<typeof getNavItemsByRole>) => [...new Set(items.map((item) => item.group))]

describe("menu Finance (point 4)", () => {
  const items = getNavItemsByRole("director", FINANCE_PERMISSIONS)
  const finance = items.filter((item) => item.group === "Finance")

  it("organise Finance en quatre sous-groupes cohérents, salaires inclus", () => {
    expect(toNavBlocks(finance).map((block) => [block.section, block.items.map((item) => item.label)])).toEqual([
      ["Vue d’ensemble", ["Vue financière", "Recouvrement détaillé"]],
      ["Encaissement", ["Encaissements", "Journal de caisse", "Historique & reçus"]],
      ["Ajustements", ["Accords & ajustements"]],
      ["Personnel", ["Salaires professeurs"]],
    ])
    expect(items.filter((item) => item.group === "Administration").map((item) => item.label)).toEqual(["Paramètres"])
  })

  it("sort les abonnements dans un groupe à part, placé après Finance", () => {
    expect(items.filter((item) => item.group === "Abonnements").map((item) => item.label)).toEqual(["Abonnements parents", "Revenus abonnements"])
    expect(groupsOf(items).slice(groupsOf(items).indexOf("Finance"))).toEqual(["Finance", "Abonnements", "Administration"])
  })

  it("ne modifie aucune route", () => {
    expect(finance.map((item) => item.href)).toEqual([
      FINANCE_PATHS.dashboard, FINANCE_PATHS.recovery, FINANCE_PATHS.entry, FINANCE_PATHS.journal, FINANCE_PATHS.history, FINANCE_PATHS.agreements, "/salaries",
    ])
    expect(items.filter((item) => item.group === "Abonnements").map((item) => item.href)).toEqual(["/subscriptions", "/subscriptions/revenue"])
  })

  it("masque le groupe Abonnements quand la fonctionnalité est désactivée", () => {
    expect(groupsOf(filterNavItemsByFeatures(items, { ...features, subscriptionsEnabled: false }))).not.toContain("Abonnements")
    expect(groupsOf(filterNavItemsByFeatures(items, features))).toContain("Abonnements")
  })

  it("adapte le menu aux permissions", () => {
    const labels = (permissions: string[]) => filterNavItemsByFeatures(getNavItemsByRole("staff", permissions as never[]), features)
      .filter((item) => ["Finance", "Abonnements"].includes(item.group)).map((item) => item.label)
    expect(labels(["payments.record"])).toEqual(["Encaissements"])
    expect(labels(["salary.view"])).toEqual(["Salaires professeurs"])
    expect(labels(["subscriptions.view"])).toEqual(["Abonnements parents"])
    expect(labels(["payments.view", "tuition.view"])).toEqual(["Vue financière", "Recouvrement détaillé", "Journal de caisse", "Historique & reçus", "Accords & ajustements"])
    expect(labels(["students.view"])).toEqual([])
  })

  it("garde des icônes distinctes pour le journal de caisse et les abonnements", () => {
    const cashJournal = items.find((item) => item.label === "Journal de caisse")
    const parentSubscriptions = items.find((item) => item.label === "Abonnements parents")
    expect(cashJournal?.icon).toBeDefined()
    expect(cashJournal?.icon).not.toBe(parentSubscriptions?.icon)
  })
})
