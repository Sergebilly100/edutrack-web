import { describe, expect, it } from "vitest"

import { exportFileName } from "./export-file-name"

describe("exportFileName", () => {
  it("construit un nom explicite sans accent ni espace", () => {
    expect(exportFileName("eleves", "2025-2026", new Date(2026, 10, 8))).toBe("eleves-2025-2026-2026-11-08.xlsx")
    expect(exportFileName("professeurs", "Année « Spéciale »", new Date(2026, 10, 8))).toBe("professeurs-annee-speciale-2026-11-08.xlsx")
  })
})
