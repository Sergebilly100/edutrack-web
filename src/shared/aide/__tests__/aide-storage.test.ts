import { beforeEach, describe, expect, it } from "vitest"

import { aideKey, markAideOpened, readHideBadges, wasAideOpened, writeHideBadges } from "../aide-storage"

const a = { tenantId: "t1", userId: "u1" }

beforeEach(() => localStorage.clear())

describe("mémorisation de l'aide", () => {
  it("utilise une clé par école, par utilisateur et par page", () => {
    expect(aideKey(a, "students")).toBe("ivoiredu-aide:t1:u1:students")
    markAideOpened(a, "students")
    expect(wasAideOpened(a, "students")).toBe(true)
    expect(wasAideOpened({ ...a, userId: "u2" }, "students")).toBe(false)
    expect(wasAideOpened({ ...a, tenantId: "t2" }, "students")).toBe(false)
    expect(wasAideOpened(a, "teachers")).toBe(false)
  })

  it("migre une fois l'ancienne clé de visite puis la supprime", () => {
    localStorage.setItem("ivoiredu-tour-done-students", "1")
    expect(wasAideOpened(a, "students")).toBe(true)
    expect(localStorage.getItem("ivoiredu-tour-done-students")).toBeNull()
    expect(localStorage.getItem(aideKey(a, "students"))).toBe("1")
  })

  it("mémorise « ne plus afficher la pastille » par utilisateur", () => {
    expect(readHideBadges(a)).toBe(false)
    writeHideBadges(a, true)
    expect(readHideBadges(a)).toBe(true)
    expect(readHideBadges({ ...a, userId: "u2" })).toBe(false)
    writeHideBadges(a, false)
    expect(readHideBadges(a)).toBe(false)
  })

  it("reste utilisable quand le stockage est indisponible", () => {
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = () => { throw new Error("indisponible") }
    try {
      expect(wasAideOpened(a, "students")).toBe(false)
      expect(readHideBadges(a)).toBe(false)
    } finally {
      Storage.prototype.getItem = original
    }
  })
})
