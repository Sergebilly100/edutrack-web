import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ download: vi.fn() }))
vi.mock("@/shared/api/excelExport.api", () => ({ downloadExcelExport: mocks.download }))

import { exportStudentsExcel } from "../students.api"

describe("exportStudentsExcel", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.download.mockResolvedValue(undefined) })

  it("filtré : n'exporte que les inscrits confirmés, comme la liste", async () => {
    await exportStudentsExcel({ schoolYearId: "y", schoolYearLabel: "2025-2026", filters: { classId: "c", isActive: false, search: "ab" } })
    expect(mocks.download).toHaveBeenCalledWith("/students/export", {
      school_year_id: "y", class_id: "c", level_id: undefined, is_active: "false", search: "ab", enrollment_status: "confirmed",
    }, expect.stringMatching(/^eleves-2025-2026-\d{4}-\d{2}-\d{2}\.xlsx$/))
  })

  it("tout : aucun filtre, tous les statuts d'inscription", async () => {
    await exportStudentsExcel({ schoolYearId: "y", schoolYearLabel: "2025-2026" })
    expect(mocks.download).toHaveBeenCalledWith("/students/export", {
      school_year_id: "y", class_id: undefined, level_id: undefined, is_active: undefined, search: undefined, enrollment_status: undefined,
    }, expect.any(String))
  })
})
