import { describe, expect, it } from "vitest"

import { filterNavItemsByFeatures, getNavItemsByRole } from "@/shared/components/layout/nav-items"

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
  it("est visible avec une permission du workflow et masquée sans permission", () => {
    expect(getNavItemsByRole("staff", ["enrollments.edit"]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ href: "/enrollments" })]))
    expect(getNavItemsByRole("staff", ["students.view"]))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ href: "/enrollments" })]))
  })
})
