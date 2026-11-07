import { describe, expect, it } from "vitest"

import { formatNationality } from "@/shared/lib/identity"
import { getCountryName, getDemonym, listCountries, parseNationality } from "@/shared/lib/nationality"

describe("nationality", () => {
  it("donne le nom français et le gentilé selon le sexe", () => {
    expect(getCountryName("CI")).toBe("Côte d'Ivoire")
    expect(getDemonym("CI", "M")).toBe("Ivoirien")
    expect(getDemonym("CI", "F")).toBe("Ivoirienne")
  })

  it("retombe sur le nom du pays si aucun gentilé n’est connu", () => {
    expect(getDemonym("NZ", "F")).toBe(getCountryName("NZ"))
  })

  it("reconnaît codes, noms et gentilés sans accents", () => {
    expect(parseNationality("ci")).toBe("CI")
    expect(parseNationality("senegalaise")).toBe("SN")
    expect(parseNationality("Ivoiriene")).toBeNull()
  })

  it("met la Côte d’Ivoire en tête d’une liste complète", () => {
    const countries = listCountries()
    expect(countries[0]?.code).toBe("CI")
    expect(countries).toHaveLength(249)
  })

  it("affiche le gentilé seulement si le sexe est connu (jamais de genre deviné)", () => {
    expect(formatNationality("CI", "F")).toBe("Ivoirienne")
    expect(formatNationality("CI", null)).toBe("Côte d'Ivoire")
    expect(formatNationality(null, "F")).toBeNull()
  })
})
