import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ download: vi.fn() }))
vi.mock("@/shared/api/excelExport.api", () => ({ downloadExcelExport: mocks.download }))

import { exportTeachersExcel } from "../teachers.api"

describe("exportTeachersExcel", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.download.mockResolvedValue(undefined) })

  it("filtré : transmet type, statut et matière avec l'année choisie", async () => {
    await exportTeachersExcel({ schoolYearId: "y", schoolYearLabel: "2025-2026", filters: { type: "vacataire", isActive: true, subject: "Maths" } })
    expect(mocks.download).toHaveBeenCalledWith("/teachers/export", { school_year_id: "y", type: "vacataire", is_active: "true", subject: "Maths" },
      expect.stringMatching(/^professeurs-2025-2026-/))
  })

  it("tout : ne transmet que l'année", async () => {
    await exportTeachersExcel({ schoolYearId: "y", schoolYearLabel: "2025-2026" })
    expect(mocks.download).toHaveBeenCalledWith("/teachers/export", { school_year_id: "y", type: undefined, is_active: undefined, subject: undefined }, expect.any(String))
  })
})
