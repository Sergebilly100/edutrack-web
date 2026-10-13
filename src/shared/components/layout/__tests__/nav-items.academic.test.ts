import { describe, expect, it } from "vitest"

import { filterNavItemsByFeatures, getNavItemsByRole, isNavItemActive } from "@/shared/components/layout/nav-items"

describe("navigation de la structure scolaire", () => {
  it("réserve le suivi des évaluations à la direction et au staff autorisé", () => {
    expect(getNavItemsByRole("director").map((item) => item.href)).toContain("/academic/evaluations")
    expect(getNavItemsByRole("staff", ["evaluations.view"]).map((item) => item.href)).toContain("/academic/evaluations")
    expect(getNavItemsByRole("staff", ["report_cards.view"]).map((item) => item.href)).not.toContain("/academic/evaluations")
    expect(getNavItemsByRole("teacher").map((item) => item.href)).not.toContain("/academic/evaluations")
  })
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
  it("expose un seul menu aux lecteurs des dossiers élèves ou des inscriptions", () => {
    expect(getNavItemsByRole("staff", ["enrollments.view"]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ href: "/records", label: "Inscriptions & dossiers" })]))
    expect(getNavItemsByRole("staff", ["enrollments.edit"]))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ href: "/records" })]))
    expect(getNavItemsByRole("staff", ["students.view"]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ href: "/records" })]))
    const fullAccessItems = getNavItemsByRole("staff", ["students.view", "enrollments.view"])
    expect(fullAccessItems.filter((item) => item.href === "/records")).toHaveLength(1)
    expect(fullAccessItems.map((item) => item.href)).not.toContain("/students")
    expect(fullAccessItems.map((item) => item.href)).not.toContain("/enrollments")
  })
})

describe("navigation de l’historique scolaire", () => {
  it("garde le menu unique actif sur les anciens liens élèves et inscriptions", () => {
    const items = getNavItemsByRole("staff", ["students.view"])
    const item = items.find((entry) => entry.href === "/records")!
    expect(item.group).toBe("Vie scolaire")
    expect(isNavItemActive(item, "/records", "")).toBe(true)
    expect(isNavItemActive(item, "/students/history", "")).toBe(true)
    expect(isNavItemActive(item, "/students/student-1", "")).toBe(true)
    expect(isNavItemActive(item, "/enrollments", "?tab=re-enrollment")).toBe(true)
    expect(items.map((entry) => entry.href)).not.toContain("/students/history")
  })
})

describe("navigation académique professeur", () => {
  it("expose l’accueil, les cours, les notes et le compte à tout professeur", () => {
    expect(getNavItemsByRole("teacher").map((item) => item.label)).toEqual([
      "Aujourd’hui",
      "Mes cours",
      "Notes",
      "Compte",
    ])
  })

  it("réserve l’entrée Conduite au staff habilité et conserve Notes comme seule entrée professeur", () => {
    expect(getNavItemsByRole("teacher").map((item) => item.href)).not.toContain("/academic/conduct")
    expect(getNavItemsByRole("teacher", ["conduct.finalize"]).map((item) => item.href)).not.toContain("/academic/conduct/decision")
    const staffConductItems = getNavItemsByRole("staff", ["conduct.finalize"])
      .filter((item) => item.href === "/academic/conduct")
    expect(staffConductItems).toHaveLength(1)
    expect(staffConductItems[0]).toMatchObject({ group: "Académique" })
  })
})

describe("navigation finance d'un staff restreint", () => {
  it("n'affiche que les écrans réellement ouvrables", () => {
    const entryStaff = getNavItemsByRole("staff", ["payments.record"])
    expect(entryStaff.map((item) => item.href)).toEqual(expect.arrayContaining([
      "/finance/encaissements",
    ]))
    expect(entryStaff.map((item) => item.href)).not.toContain("/finance/history")

    const viewStaff = getNavItemsByRole("staff", ["payments.view"])
    expect(viewStaff.map((item) => item.href)).toEqual(expect.arrayContaining([
      "/finance/dashboard",
      "/finance/recovery",
      "/finance/history",
      "/finance/journal",
      "/settings",
    ]))
    expect(viewStaff.map((item) => item.href)).not.toContain("/finance/encaissements")
    expect(getNavItemsByRole("staff", ["payments.record"]).map((item) => item.href)).not.toContain("/finance/recovery")
    expect(viewStaff.find((item) => item.href === "/finance/recovery")).toMatchObject({ group: "Finance", mobileVisible: false })
  })
})

describe("navigation des règles de risque", () => {
  it("affiche Paramètres à un staff détenteur de risk_alerts.edit", () => {
    const items = getNavItemsByRole("staff", ["risk_alerts.edit"])
    expect(items).toEqual(expect.arrayContaining([expect.objectContaining({ href: "/settings" })]))
  })
})

describe("groupes de navigation direction", () => {
  it("place les validations dans Pilotage, juste après le tableau de bord", () => {
    const items = getNavItemsByRole("director")
    expect(items.slice(0, 2)).toEqual([
      expect.objectContaining({ label: "Tableau de bord", group: "Pilotage" }),
      expect.objectContaining({ label: "Validations horaires", group: "Pilotage" }),
    ])
  })
})

describe("état actif de navigation", () => {
  it("remplace Complétude par l’espace Bulletins", () => {
    const labels = getNavItemsByRole("director").map((item) => item.label)
    expect(labels).toContain("Bulletins")
    expect(labels).not.toContain("Complétude")
  })

  it("ne sélectionne pas Structure sur l’écran Bulletins", () => {
    const structure = getNavItemsByRole("director").find((item) => item.href === "/academic")
    expect(structure).toBeDefined()
    expect(isNavItemActive(structure!, "/academic/report-cards", "")).toBe(false)
    expect(isNavItemActive(structure!, "/academic/classes", "")).toBe(true)
  })

  it("sélectionne une seule destination Finance", () => {
    const items = getNavItemsByRole("director").filter((item) => item.href.startsWith("/finance/"))
    const activeItems = items.filter((item) => isNavItemActive(item, "/finance/history", ""))
    expect(activeItems).toEqual([expect.objectContaining({ href: "/finance/history" })])
  })
})
