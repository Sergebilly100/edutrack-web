import { describe, expect, it } from "vitest"

import { filterNavItemsByFeatures, getNavItemsByRole, isNavItemActive } from "@/shared/components/layout/nav-items"

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

describe("navigation de fin d’année", () => {
  const items = getNavItemsByRole("staff", ["class_decisions.view"])

  it("reste masquée avant la date seuil", () => {
    expect(filterNavItemsByFeatures(items, {
      subscriptionsEnabled: false,
      endOfYearReviewVisible: false,
    })).not.toEqual(expect.arrayContaining([expect.objectContaining({ href: "/end-of-year" })]))
  })

  it("devient visible lorsque la date seuil est atteinte", () => {
    expect(filterNavItemsByFeatures(items, {
      subscriptionsEnabled: false,
      endOfYearReviewVisible: true,
    })).toEqual(expect.arrayContaining([expect.objectContaining({ href: "/end-of-year" })]))
  })
})

describe("navigation des inscriptions", () => {
  it("utilise la permission de lecture réellement requise par l'écran", () => {
    expect(getNavItemsByRole("staff", ["enrollments.view"]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ href: "/enrollments" })]))
    expect(getNavItemsByRole("staff", ["enrollments.edit"]))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ href: "/enrollments" })]))
    expect(getNavItemsByRole("staff", ["students.view"]))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ href: "/enrollments" })]))
  })
})

describe("navigation académique professeur", () => {
  it("expose le planning, les évaluations et le compte à tout professeur", () => {
    expect(getNavItemsByRole("teacher").map((item) => item.label)).toEqual([
      "Mon planning",
      "Évaluations & notes",
      "Mon compte",
    ])
  })

  it("n'expose la décision finale qu'au détenteur de conduct.finalize", () => {
    expect(getNavItemsByRole("teacher").map((item) => item.href)).not.toContain("/academic/conduct/decision")
    expect(getNavItemsByRole("teacher", ["conduct.finalize"]).map((item) => item.href)).toContain("/academic/conduct/decision")
    const staffConductItems = getNavItemsByRole("staff", ["conduct.finalize"])
      .filter((item) => item.href === "/academic/conduct/decision")
    expect(staffConductItems).toHaveLength(1)
    expect(staffConductItems[0]).toMatchObject({ group: "Académique" })
  })
})

describe("navigation finance d'un staff restreint", () => {
  it("n'affiche que les écrans réellement ouvrables", () => {
    const entryStaff = getNavItemsByRole("staff", ["payments.record"])
    expect(entryStaff.map((item) => item.href)).toEqual(expect.arrayContaining([
      "/finance?tab=entry",
      "/finance?tab=import",
    ]))
    expect(entryStaff.map((item) => item.href)).not.toContain("/finance?tab=history")

    const viewStaff = getNavItemsByRole("staff", ["payments.view"])
    expect(viewStaff.map((item) => item.href)).toEqual(expect.arrayContaining([
      "/finance?tab=dashboard",
      "/finance?tab=history",
      "/finance?tab=journal",
      "/settings",
    ]))
    expect(viewStaff.map((item) => item.href)).not.toContain("/finance?tab=entry")
    expect(viewStaff.map((item) => item.href)).not.toContain("/finance?tab=tuition")
    expect(viewStaff.map((item) => item.href)).not.toContain("/finance?tab=alerts")
    expect(viewStaff.map((item) => item.href)).not.toContain("/finance?tab=settings")
  })
})

describe("groupes de navigation direction", () => {
  it("place les validations dans Pilotage, juste après le tableau de bord", () => {
    const items = getNavItemsByRole("director")
    expect(items.slice(0, 2)).toEqual([
      expect.objectContaining({ label: "Tableau de bord", group: "Pilotage" }),
      expect.objectContaining({ label: "Validations", group: "Pilotage" }),
    ])
  })
})

describe("état actif de navigation", () => {
  it("ne sélectionne pas Structure sur les écrans Complétude ou Bulletins", () => {
    const structure = getNavItemsByRole("director").find((item) => item.href === "/academic")
    expect(structure).toBeDefined()
    expect(isNavItemActive(structure!, "/academic/completion", "")).toBe(false)
    expect(isNavItemActive(structure!, "/academic/report-cards", "")).toBe(false)
    expect(isNavItemActive(structure!, "/academic/classes", "")).toBe(true)
  })

  it("sélectionne un seul onglet Finance selon le paramètre tab", () => {
    const items = getNavItemsByRole("director").filter((item) => item.href.startsWith("/finance?tab="))
    const activeItems = items.filter((item) => isNavItemActive(item, "/finance", "?tab=history"))
    expect(activeItems).toEqual([expect.objectContaining({ href: "/finance?tab=history" })])
  })
})
