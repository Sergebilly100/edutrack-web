import { describe, expect, it } from "vitest"
import { countMissingMandatoryDocuments, getScaledDimensions } from "../enrollments.helpers"

describe("enrollment helpers", () => {
  it("redimensionne le grand côté sans déformer l’image", () => {
    expect(getScaledDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(getScaledDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it("compte seulement les pièces obligatoires non fournies", () => {
    const base = { studentId: "student", fileUrl: null, r2Key: null, providedAt: null, notes: null }
    expect(countMissingMandatoryDocuments([
      { ...base, id: "1", documentTypeId: "a", documentTypeName: "Extrait", isMandatory: true, status: "missing" },
      { ...base, id: "2", documentTypeId: "b", documentTypeName: "Photo", isMandatory: true, status: "provided" },
      { ...base, id: "3", documentTypeId: "c", documentTypeName: "Carnet", isMandatory: false, status: "to_renew" },
    ])).toBe(1)
  })
})
